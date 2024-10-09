/**
 * This module manages the whole logic of the AI tab. 
 * 
 * Starting with the initialization of the tab and the fetching of growth and history data for a patient. 
 * Followed by the communication with the OpenAI API to provide an analysis of (1) growth abnormalities and 
 * (2) patient history, (3) a recommendation for specialist referral, (4) a differential diagnosis and (5) an
 * executive summary based on the analysis including evidence-based guidelines as citations. 
 * Furthermore, the module offers a chat allowing the user to ask questions about the case and to upload new
 * guidelines.
 * 
 * Dependencies:
 * - Global variables: GC, jQuery, XDate
 * - OpenAI API for assistant interactions.
 * 
 * Author: Simon Moedinger
 * Date: 10/10/2024
 * 
 * Note: Ensure that the OpenAI API key and the Assistants ID are correctly set and that the application has access to the OpenAI client for functionality.
 */
(function(NS, $) {
    "use strict";
    
    const EMPTY_MARK = "undefined";   
    let openai;
    let assistantId; 
    let threadId = null; // Global thread ID
    const citationMap = new Map(); // Centralized map to track file citations
    let citationCounter = 1;  // Counter to assign new citation numbers
    let currentFiles = []; // arry of used files/guidelines
    let promptHistory, promptGrowth = "";

    // Document ready function
    $(function() {
        initAITab();
    });

      /**
        * Initializes the AI tab, sets up event listeners, and logs debugging information.
        */
      function initAITab() {
        
        $("#tab-btn-left").hide();

        // Wait for OpenAI client to be initialized
        const intervalId = setInterval(() => {
            if (openai) {
                clearInterval(intervalId);
                getAssistant(); 
            }
        }, 100);

        $("#view-ai").data("initialized", true);

        let dataFetched = false; // Flag to track if data has been fetched

        $("#view-mode span").on("click", function() {
            const tab = $(this).data("value");

            $(".tab-panel").hide();
            $("#view-" + tab).show();

            if (tab === "ai") {
                $("#timeline-top, #timeline-bottom, #time-ranges, #info-bar").hide();

                // Disable the buttons in #the-tab when AI tab is active
                disableTabButtons();

                if (!dataFetched) {
                    fetchDataAndSendPrompt();
                    dataFetched = true; // Set flag to true after fetching data
                }
            } else {
                // Enable the buttons in #the-tab when AI tab is not active
                enableTabButtons();
    
                // Show the hidden elements again
                $("#timeline-top, #timeline-bottom, #time-ranges, #info-bar").show();
            }
        });

        // Prompt button
        $("#show-prompt-button").on("click", function() {
            showPromptPopup(promptGrowth, promptHistory);
        });
        
        // Chat button
        $("#chat-button").on("click", function() {
            showChat();
            // move sections from the center more to the left.
            $(".ai-response, .ai-response-diagnoses, .ai-response-growth, .ai-response-history, .ai-response-clinical").css({
                "margin-left": "0px",
                "max-width": "700px"
            });

            $(".abnormality-warning").css({
                "margin-left": "390px",
            });
            
        });
    }

    /**
     * Disables tab buttons which are not necessary in AI tab to prevent user interaction.
     */
    function disableTabButtons() {
        document.querySelectorAll('#tab-btn-left, #tab-btn-switch, #tab-btn-right, #primary-ds, #secondary-ds')
            .forEach(button => {
                button.style.pointerEvents = 'none';  // Disable interactions
                button.style.opacity = '0.5';        
            });
    }
    
    /**
     * Enables tab buttons which are necessary in other tabs to allow user interaction.
     */
    function enableTabButtons() {
        document.querySelectorAll('#tab-btn-left, #tab-btn-switch, #tab-btn-right, #primary-ds, #secondary-ds')
            .forEach(button => {
                button.style.pointerEvents = 'auto';  // Re-enable interactions
                button.style.opacity = '1';         
            });
    }

        /**
         * Verify and initialize global openai object.
         */
        document.addEventListener("DOMContentLoaded", function() {
            if (window.OpenAI) {
                try {
                    openai = new window.OpenAI({ 
                        apiKey: 'API-KEY',
                        dangerouslyAllowBrowser: true
                    });
                } catch (error) {
                    showErrorPopup('Error initializing OpenAI. Contact your administrator:', error);
                }
            } else {
                console.error('OpenAI is not loaded');
                showErrorPopup('Error OpenAI is not loaded, Try to refresh the page or contact your administrator.');
            }
        });

    /**
     * Fetches patient data including name, sex, date of birth, age, and entries from the patient model.
     * Retrieves historical data from the patient's history (load-patient-history.js).
     * @returns {Promise<Object>} - An object containing patient details (name, sex, dob, age, entries, patientHistory).
     */
    async function fetchPatientData() {
        let patient = GC.App.getPatient();
        if (!patient) {
            console.error("No patient data available.");
            return null;
        }
    
        let entries = patient.getModel(); // Get all entries
        if (!entries || entries.length === 0) {
            console.error("No entries available for the patient.");
            //return null;
        }

        let name = patient.name;
        let sex = patient.gender;
        let dob = patient.DOB.toString("yyyy-MM-dd");
        let age = new GC.TimeInterval().setStartDate(patient.DOB);
        let patientHistory = await GC.getPatientHistory(); // get history from load-patient-history.js
    
        return { name, sex, dob, age, entries, patientHistory };
    }

    /**
     * Fetches patient data and generates prompts for growth and history analysis.
     * Sends these prompts to sendToAssistant for processing.
     */
    async function fetchDataAndSendPrompt() {
        let { name, sex, dob, age, entries, patientHistory } = await fetchPatientData();
        promptGrowth = createPromptGrowth(name, sex, dob, age, entries);
        promptHistory = await createPromptHistory(patientHistory);
        
       /* if (!data) {
            document.getElementById('ai-response-growth-data').textContent = "No growth data available for the patient.";
            return;
        }*/

        await sendToAssistant(promptGrowth, promptHistory);
    }

    /**
     * Creates the first prompt for the patient's growth data for anomalies.
     * Constructs a detailed prompt including height, weight, head circumference, z-scores, and percentiles.
     * @param {string} name - The patient's name.
     * @param {string} sex - The patient's gender.
     * @param {string} dob - The patient's date of birth in "yyyy-MM-dd" format.
     * @param {string} age - The patient's current age.
     * @param {Array} entries - An array of patient entries containing growth measurements.
     * @returns {string} - The formatted growth analysis prompt.
     */
    function createPromptGrowth(name, sex, dob, age, entries) {
        promptGrowth = `First, analyze the patients growth parameters to determine whether there is an anomaly in the data. Look at the height, weight and head circumference as well as the z-scores and percentiles. Use the attached clinical practice guidelines as a reference for your justification. Focus on the most important points and limit yourself to a maximum of four bullet points. \n`; 
        promptGrowth += `The patient's name is ${name}, the sex is ${sex} and the date of birth is ${dob}. Accordingly, the age today is ${age}.\nHere are the patient's growth data (oldest measurement first):\n`;

        entries.forEach((entry, index) => {
            let dateOfEntry = getEntryDate(index);
            let length = getLength(entry);
            let lPercentile = getPercentile(entry, "lengthAndStature");
            let lZscore = getZScore(entry, "lengthAndStature");
            let lVelocity = getVelocity(entry, "lengthAndStature");

            let weight = getWeight(entry);
            let wPercentile = getPercentile(entry, "weight");
            let wZscore = getZScore(entry, "weight");
            let wVelocity = getVelocity(entry, "weight");

            let headC = getHeadC(entry);
            let headCPercentile = getPercentile(entry, "headc");
            let hcZscore = getZScore(entry, "headc");
            let hcVelocity = getVelocity(entry, "headc");

            let bmi = getBMI(entry);
            let boneAge = entry.boneAge ? new GC.TimeInterval().setMonths(entry.boneAge).toString(boneAgeFormat) : EMPTY_MARK;

            promptGrowth += `<i>Entry ${index + 1}</i>:\nDate: ${dateOfEntry}\n`;
            if (length !== EMPTY_MARK) promptGrowth += `Length (cm): ${length}, `;
            if (lPercentile !== EMPTY_MARK) promptGrowth += `Length Percentile (%): ${lPercentile}, `;
            if (lZscore !== EMPTY_MARK) promptGrowth += `Length Z-Score (Z): ${lZscore}, `;
            if (lVelocity !== EMPTY_MARK) promptGrowth += `Length Velocity (cm/yr): ${lVelocity}, `;

            if (weight !== EMPTY_MARK) promptGrowth += `Weight (kg): ${weight}, `;
            if (wPercentile !== EMPTY_MARK) promptGrowth += `Weight Percentile (%): ${wPercentile}, `;
            if (wZscore !== EMPTY_MARK) promptGrowth += `Weight Z-Score (Z): ${wZscore}, `;
            if (wVelocity !== EMPTY_MARK) promptGrowth += `Weight Velocity (kg/yr): ${wVelocity}, `;

            if (headC !== EMPTY_MARK) promptGrowth += `Head Circumference (cm): ${headC}, `;
            if (headCPercentile !== EMPTY_MARK) promptGrowth += `Head Circumference Percentile (%): ${headCPercentile}, `;
            if (hcZscore !== EMPTY_MARK) promptGrowth += `Head Circumference Z-Score (Z): ${hcZscore}, `;
            if (hcVelocity !== EMPTY_MARK) promptGrowth += `Head Circumference Velocity (cm/yr): ${hcVelocity}, `;

            if (bmi !== EMPTY_MARK) promptGrowth += `BMI (kg/m2): ${bmi}, `;
            if (boneAge !== EMPTY_MARK) promptGrowth += `Bone Age (y-m): ${boneAge}, `;

            // Remove trailing comma and space
            promptGrowth = promptGrowth.trim();
            if (promptGrowth.endsWith(',')) {
                promptGrowth = promptGrowth.slice(0, -1);
            }

            // Add new line after each entry
            promptGrowth += `\n\n`;
        });
        return promptGrowth;
    }

    /**
     * Creates a prompt to analyze the patient's medical history based on available data.
     * If no data is available, a fallback message is returned.
     * @param {Array} patientHistory - An array of patient history entries.
     * @returns {string} - The formatted patient history analysis prompt.
     */
    async function createPromptHistory(patientHistory) {
        if (patientHistory.length === 0) {
            promptHistory = `No historical data for this patient available.`;
        } else {
            promptHistory = `Now that you have analyzed the growth data, also analyze the history of the patient and include it in your assessment. Focus on the most important points which could be relevant for the doctor to assess the patients health. Use the attached clinical practice guidelines as a reference for your justification. Describe the results of your analysis in maximum three bullet points and keep your results concise. Here is the history of the patient: \n`; 
            patientHistory.forEach((entry, index) => {
                promptHistory += `<i>Entry ${index + 1}</i>:\nDate: ${entry.timestamp}\nDetails: ${entry.data}\n`; 
                // Add new line after each entry
                promptHistory += `\n\n`;
            });
        }
     
        return promptHistory;
    }

    /**
     * Retrieves the assistant ID using the OpenAI API.
     * @returns {Promise<string>} - A Promise resolving to the assistant ID or logs an error if unsuccessful.
     */
    async function getAssistant() {
        try {
            const myAssistant = await openai.beta.assistants.retrieve(
                "asst_6LEnciXiGknEgzaJKlrssixL"
            );
            return assistantId = myAssistant.id;
        } catch (error) {
            console.error("Error retrieving assistant:", error);
        }
    }

    /**
     * Handles the main logic and sends all prompts to the assistant, processes responses and displayes them 
     * in the UI.
     * @param {string} promptGrowth - The growth prompt to send to the assistant. Built in createPromptGrowth.
     * @param {string} promptHistory - The patient history prompt to send to the assistant. Built in createPromptHistory.
     */
    async function sendToAssistant(promptGrowth, promptHistory) {
        try {
            const thread = await openai.beta.threads.create();
            threadId = thread.id;
    
            /**
             * Displays the assistant's response based on the response key.
             * @param {string} responseKey - The response key indicating the type of response (e.g., growth, history).
             * @param {string} responseContent - The content of the assistant's response.
             * @param {Array} annotations - Annotations included in the response for citation.
             */
            const displayResponse = (responseKey, responseContent, annotations) => {
                const responseElementId = {
                    growth: 'ai-response-growth-data',
                    history: 'ai-response-patient-history',
                    diagnosis: 'ai-response-growth-diagnoses',
                    clinicalSteps: 'ai-response-clinical-steps',
                    summary: 'ai-response-summary'
                }[responseKey];
    
                const element = document.getElementById(responseElementId);
                if (element) {
                    const updatedContent = updateCitations(responseContent, annotations);
                    element.innerHTML = updatedContent ? formatResponse(updatedContent) : "No response.";
                }
            };
    
            const processMessage = async (promptContent, responseKey, processAnnotations = true) => {
                const message = await openai.beta.threads.messages.create(threadId, {
                    role: "user",
                    content: promptContent
                });
    
                let run = await openai.beta.threads.runs.createAndPoll(
                    threadId,
                    {
                        assistant_id: assistantId,
                        instructions: " "
                    }
                );
    
                if (run.status === 'completed') {
                    const messages = await openai.beta.threads.messages.list(run.thread_id);
    
                    for (const message of messages.data.reverse()) {
                        if (message.role === 'assistant' && message.content[0]?.text?.value) {
                            const responseContent = message.content[0].text.value;
                            const annotations = message.content[0].text.annotations;
                            displayResponse(responseKey, responseContent, annotations);
    
                            if (processAnnotations) {
                                if (!annotations || annotations.length === 0) {
                                    await displayFiles([]);
                                } else {
                                    const fileNames = await getFiles(annotations);
                                    await displayFiles(fileNames);
                                }
                            }
                        }
                    }
                } else {
                    const element = document.getElementById('ai-response-summary');
                    element.innerHTML = "An error occurred. Try to refresh the page or contact your administrator.";
                    showErrorPopup("Error Message wasn't processed. Try to refresh the page or contact your administrator.");
                }
            };
    
            // Process messages and display responses
            await processMessage(promptGrowth, "growth");

            // second prompt to display warning
            const abnormalityCheckPrompt = "If you have detected an abnormality in the growth data, reply with 'Yes'. If not, reply with 'No'.";
            const abnormalityMessage = await openai.beta.threads.messages.create(threadId, {
                role: "user",
                content: abnormalityCheckPrompt
            });
            let run = await openai.beta.threads.runs.createAndPoll(
                threadId,
                {
                    assistant_id: assistantId,
                    instructions: " "
                }
            );
    
            if (run.status === 'completed') {
                const messages = await openai.beta.threads.messages.list(run.thread_id);
                const latestMessage = messages.data[0];

                if (latestMessage.role === 'assistant' && latestMessage.content[0]?.text?.value) {
                    const abnormalityResponse = latestMessage.content[0].text.value.trim().toLowerCase();
            
                    const growthElement = document.getElementById('ai-response-growth-data');
                    if (growthElement) {
                        const aiResponseDiv = growthElement.closest('.ai-response-growth');
                        if (aiResponseDiv) {
                            if (abnormalityResponse.includes('yes')) {
                                showPopupGrowthWarning();
                            } else {
                                document.querySelectorAll('.abnormality-warning, .check-icon')
                                .forEach(el => el.style.visibility = 'visible');
                            }
                        }
                    }
                }
            }

            // second prompt history
            if (promptHistory !== "No historical data for this patient available.") {
                await processMessage(promptHistory, "history");
            } else {
                // Display the fallback message directly
                const element = document.getElementById('ai-response-patient-history');
                if (element) {
                    element.innerHTML = "No historical data for this patient available.";
                }
            }
    
            await processMessage("Provide a recommendation to which specialist you would refer the patient and for which next clinical steps. Use the attached files you referenced before for your justification. Focus on the most important points and cite the source when you use references. Answer in bullet points and limit yourself to a maximum of 6 bullet points.", "clinicalSteps");
            await processMessage("You have analyzed the data of the patient. Now give me two to three possible diagnoses with the ICD-10 Code based on the growth data.", "diagnosis", false);
            await processMessage("Create an executive summary of your analysis. Use the attached files you referenced before for your justification. Also add the recommended specialist referral. Limit yourself to a maximum of 6 bullet points.", "summary", false);
        } catch (error) {
            const element = document.getElementById('ai-response-growth-data');
            element.innerHTML = "An error occurred. Try to refresh the page or contact your administrator. (Error: ", error.message, ")";        
            showErrorPopup("An error occurred. Try to refresh the page or contact your administrator. (Error: ", error.message, ")");
            return `Error: ${error.message}`;
        }
    }

    /**
     * Formats a given response by converting markdown-like syntax to HTML.
     * Supports converting headings, bold text, and removing duplicate citations.
     * @param {string} response - The response text to format.
     * @returns {string} - The formatted HTML response.
     */
    function formatResponse(response) {
        let formattedResponse = response
            .replace(/(.*?)###### (.*?)(\n|$)/g, '<h6>$2</h6>\n')  // Headings level 6
            .replace(/(.*?)##### (.*?)(\n|$)/g, '<h5>$2</h5>\n')  // Headings level 5
            .replace(/(.*?)#### (.*?)(\n|$)/g, '<h4>$2</h4>\n')  // Headings level 4
            .replace(/(.*?)### (.*?)(\n|$)/g, '<h3>$2</h3>\n')  // Headings level 3
            .replace(/(.*?)## (.*?)(\n|$)/g, '<h2>$2</h2>\n')  // Headings level 2
            .replace(/(.*?)# (.*?)(\n|$)/g, '<h1>$2</h1>\n')  // Headings level 1
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // big text
            .replace(/(\[\d+\])(\s*\1)+/g, '$1');  // remove duplicate citations in the same line
        
            return `<p>${formattedResponse}</p>`;
    }

    /**
     * Shows a popup warning on the top right and creates the exclamation mark when an abnormality is 
     * detected in growth data.
     */
    function showPopupGrowthWarning() {
        document.querySelectorAll('.abnormality-warning, .alarm-mark')
        .forEach(el => el.style.visibility = 'visible');

        const popup = document.createElement('warning-ag-popup');
        popup.id = 'warning-ag-popup';
        popup.innerHTML = `
            <div class="warning-ag-popup">
                <pre>Warning: Abnormality in Growth Data Detected</pre>
            </div>
            `;
            
        document.body.appendChild(popup);
        popup.style.display = 'block';
    }

    /**
     * Assigns or retrieves citation numbers for files.
     * @param {string} fileId - The ID of the file to cite.
     * @returns {number} - The citation number for the file.
     */
    const getCitationNumber = (fileId) => {
        if (!citationMap.has(fileId)) {
            citationMap.set(fileId, citationCounter++);
        }
        return citationMap.get(fileId);
    };

    /**
     * Updates content with citation numbers based on annotations.
     * @param {string} content - The content to update with citations.
     * @param {Array} annotations - Annotations indicating the files to cite.
     * @returns {string} - The content with updated citations.
     */
    const updateCitations = (content, annotations) => {
        annotations.forEach(annotation => {
            if (annotation.file_citation && annotation.file_citation.file_id) {
                const fileId = annotation.file_citation.file_id;
                const citationNumber = getCitationNumber(fileId);
                content = content.replace(annotation.text, ` [${citationNumber}]`);
            }
        });
        return content;
    };

    /**
     * Retrieves files based on annotations for display.
     * @param {Array} annotations - Annotations indicating files to retrieve.
     * @returns {Promise<Array>} - A Promise resolving to an array of file information.
     */
    async function getFiles(annotations) {
        try {
            const files = [];

            for (const annotation of annotations) {
                if (annotation.file_citation && annotation.file_citation.file_id) {
                    const fileId = annotation.file_citation.file_id;
                    const citationIndex = getCitationNumber(fileId);
                    let fileData = await openai.files.retrieve(fileId);
                    files.push({
                        id: fileId,
                        name: fileData.filename,
                        citationIndex: citationIndex
                    });
                }
            }

            return files;
        } catch (error) {
            return [];
        }
    }

    /**
     * Displays the used files (guidelines) and the download buttons in the user sidebar.
     * @param {Array} files - An array of files.
     */
    async function displayFiles(files) {
        const guidelineFilesDiv = document.getElementById('guideline-files');
        const newFiles = [];

        files.forEach(file => {
            let fileEntry = currentFiles.find(entry => entry.name === file.name);
            if (!fileEntry) {
                // New file entry, add to the current list and mark for display
                newFiles.push(file);
                currentFiles.push({ name: file.name, citationIndex: file.citationIndex });
            }
        });

        // Update the display only with new files
        newFiles.forEach(file => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'file-entry';

            const fileNameDiv = document.createElement('div');
            fileNameDiv.className = 'file-name';
            fileNameDiv.textContent = `${file.name} [${file.citationIndex}]`;
            fileNameDiv.dataset.name = file.name;
            fileNameDiv.dataset.citationIndex = file.citationIndex;

            const downloadIcon = document.createElement('img');
            downloadIcon.className = 'download-icon';
            downloadIcon.alt = 'Download';
            downloadIcon.src = 'ai-tab/img/download.png';

            fileDiv.appendChild(fileNameDiv);
            fileDiv.appendChild(downloadIcon);
            guidelineFilesDiv.appendChild(fileDiv);
        });

      setupDownloadButtons();
    }

    /**
     * Searches the files in /guidelines and sets up the  download buttons for files displayed in the sidebar.
     */
    function setupDownloadButtons() {
        const downloadIcons = document.querySelectorAll('.download-icon');
        downloadIcons.forEach(icon => {
            icon.addEventListener('click', (event) => {
                const fileNameDiv = event.target.previousElementSibling;
                if (fileNameDiv && fileNameDiv.classList.contains('file-name')) {
                    let fileName = fileNameDiv.textContent.trim();
                    if (fileName) {
                        if (fileName.includes('.pdf')) {
                            fileName = fileName.split('.pdf')[0] + '.pdf';
                        }
                        const filePath = `/ai-tab/guidelines/${fileName}`;
                        initiateDownload(filePath);
                    } else {
                        console.error('File name not found.');
                    }
                } else {
                    console.error('File name element not found.');
                }
            });
        });
    }
    
    /**
     * Initiates a file download given the file path.
     * @param {string} filePath - The path of the file to download.
     */
    function initiateDownload(filePath) {
        // Create a temporary link element
        const link = document.createElement('a');
        link.href = filePath;
        link.download = filePath.split('/').pop(); // Set the download attribute with the file name
        document.body.appendChild(link); // Append the link to the body
    
        link.click(); // Trigger the download
        document.body.removeChild(link); // Clean up by removing the link element
    }

    /**
     * Shows the chat interface, allowing users to interact with the assistant. Handles the whole logic.
     */
    async function showChat() {
        let chatContainer = document.getElementById('chat-container');
        if (!chatContainer) {
            chatContainer = document.createElement('div');
            chatContainer.id = 'chat-container';
            chatContainer.innerHTML = `
                <div class="chat-header">
                    Chat
                    <span class="close-button">&times;</span>
                </div>
                <div class="chat-content">
                    <ul class="chat-messages">
                        <li class="chat-message">Hello! You can upload new files and ask questions to the patients case.</li>
                    </ul>
                </div>
                <div class="chat-input-container">
                    <img src="ai-tab/img/upload.png" class="upload-button" alt="Upload PDF">
                    <input type="text" class="chat-input" placeholder="Type your message...">
                    <img src="ai-tab/img/send.png" class="send-button" alt="Send Message">
                    <input type="file" id="file-upload" style="display: none;" accept=".pdf">
                </div>
            `;
            document.body.appendChild(chatContainer);

            const closeButton = chatContainer.querySelector('.close-button');
            closeButton.addEventListener('click', function() {
                chatContainer.classList.remove('show');
                // Revert CSS changes of .ai-response
                $(".ai-response, .ai-response-diagnoses, .ai-response-growth, .ai-response-history, .ai-response-clinical").css({
                    "margin-left": "120px",
                    "max-width": "800px"
                });
                $(".abnormality-warning").css({
                    "margin-left": "500px",
                });
                setTimeout(() => {
                    chatContainer.style.display = 'none';
                    document.getElementById('chat-button-image').style.display = 'block';
                }, 200);
            });

            const chatInput = chatContainer.querySelector('.chat-input');
            const sendButton = chatContainer.querySelector('.send-button');
            const fileUpload = chatContainer.querySelector('#file-upload');

            const sendMessage = async () => {
                if (chatInput.value.trim() !== '') {
                    const messageList = chatContainer.querySelector('.chat-messages');
                    const newMessage = document.createElement('li');
                    newMessage.className = 'chat-message user';
                    newMessage.textContent = chatInput.value.trim();
                    messageList.appendChild(newMessage);

                    const loadingMessage = document.createElement('li');
                    loadingMessage.className = 'chat-message loading-dots';
                    messageList.appendChild(loadingMessage);

                    const userMessage = chatInput.value.trim();
                    chatInput.value = '';
                    chatContainer.querySelector('.chat-content').scrollTop = chatContainer.querySelector('.chat-content').scrollHeight;

                    if (threadId) {
                        await createMessage(threadId, assistantId, userMessage, loadingMessage);
                    } else {
                        loadingMessage.classList.remove('loading-dots');
                        loadingMessage.textContent = "Sorry, something went wrong. No threadID";
                    }
                }
            };

            chatInput.addEventListener('keypress', async function(event) {
                if (event.key === 'Enter') {
                    await sendMessage();
                }
            });

            sendButton.addEventListener('click', sendMessage);

            // File upload button logic
            const uploadButton = chatContainer.querySelector('.upload-button');
            uploadButton.addEventListener('click', function() {
                fileUpload.click();
            });

            fileUpload.addEventListener('change', async function(event) {
                const file = event.target.files[0];
                if (file) {
                    try {
                        const uploadedFile = await openai.files.create({
                            file: file,
                            purpose: "assistants",
                        });

                        // Add the file to the vector store and update the thread or assistant
                        const vectorStoreId = 'vs_2qk1H6IH8mPG1hI77hRElznk'; 
                        await openai.beta.vectorStores.files.createAndPoll(vectorStoreId, {
                            file_id: uploadedFile.id
                        });

                        chatContainer.querySelector('.chat-messages').innerHTML += `<li class="chat-message">File uploaded successfully. You can now ask questions about the content of the file.</li>`;
                    } catch (error) {
                        console.error('Error uploading file:', error);
                        chatContainer.querySelector('.chat-messages').innerHTML += `<li class="chat-message">Failed to upload file. Please try again.</li>`;
                    }
                }
            });
        }
        chatContainer.style.display = 'flex';
        setTimeout(() => {
            chatContainer.classList.add('show');
        }, 10);
        document.getElementById('chat-button-image').style.display = 'none';
    }

    /**
     * Sends a message to the assistant thread for the chat
     * @param {string} threadId - The ID of the thread to which the message belongs.
     * @param {string} assistantId - The ID of the assistant.
     * @param {string} userMessage - The user's message content.
     * @param {HTMLElement} loadingMessage - The loading message element to update.
     */
    async function createMessage(threadId, assistantId, userMessage, loadingMessage) {
        try {
            await openai.beta.threads.messages.create(threadId, {
                role: "user",
                content: userMessage
            });

            // Run the assistant to get the response
            await runAssistant(threadId, assistantId, loadingMessage);
        } catch (error) {
            console.error('Error in createMessage:', error);
            loadingMessage.classList.remove('loading-dots');
            loadingMessage.textContent = "Sorry something went wrong.";
        }
    }

    /**
     * Runs the assistant to process messages in the thread and provides a response for the chat
     * @param {string} threadId - The ID of the thread to run the assistant on.
     * @param {string} assistantId - The ID of the assistant.
     * @param {HTMLElement} loadingMessage - The loading message element to update.
     */
    async function runAssistant(threadId, assistantId, loadingMessage) {
        try {
            let run = await openai.beta.threads.runs.createAndPoll(threadId, {
                assistant_id: assistantId,
                instructions: " "
            });
    
            if (run.status === 'completed') {
                const messages = await openai.beta.threads.messages.list(threadId);
    
                let responseContent = null;
                const latestMessage = messages.data[0];
                if (latestMessage && latestMessage.role === 'assistant' && latestMessage.content[0]?.text?.value) {
                    responseContent = latestMessage.content[0].text.value;
                }
                if (responseContent) {
                    const annotations = latestMessage.content[0].text.annotations;
                    displayAssistantResponse(responseContent, loadingMessage, annotations);
                }
            } else {
                loadingMessage.classList.remove('loading-dots');
                loadingMessage.textContent = "Sorry something went wrong.";
            }
        } catch (error) {
            console.error('Error running assistant:', error);
            loadingMessage.classList.remove('loading-dots');
            loadingMessage.textContent = "Sorry something went wrong.";
        }
    }

    /**
     * Displays the assistant's response in the chat interface and updates citations.
     * @param {string} responseContent - The content of the assistant's response.
     * @param {HTMLElement} loadingMessage - The loading message element to update with the response.
     * @param {Array} annotations - Annotations for citations included in the response.
     */
    async function displayAssistantResponse(responseContent, loadingMessage, annotations) {
        const updatedContent = updateCitations(responseContent, annotations);
        const formattedResponse = formatResponseChat(updatedContent);
        loadingMessage.innerHTML = formattedResponse;
        loadingMessage.classList.remove('loading-dots');
        const chatContainer = document.getElementById('chat-container');
        chatContainer.querySelector('.chat-content').scrollTop = chatContainer.querySelector('.chat-content').scrollHeight;
        
        // Add new files to display if cited
        if (annotations && annotations.length > 0) {
            const newFiles = await getFiles(annotations);
            displayFiles(newFiles);
        }
    }
    
    /**
     * Formats chat response content by converting markdown-like syntax to HTML.
     * @param {string} responseContent - The content to format.
     * @returns {string} - The formatted HTML content.
     */
    function formatResponseChat(responseContent) {
        responseContent = responseContent
            .replace(/(.*?)###### (.*?)(\n|$)/g, '<h6>$2</h6>\n')  // Headings level 6
            .replace(/(.*?)##### (.*?)(\n|$)/g, '<h5>$2</h5>\n')  // Headings level 5
            .replace(/(.*?)#### (.*?)(\n|$)/g, '<h4>$2</h4>\n')  // Headings level 4
            .replace(/(.*?)### (.*?)(\n|$)/g, '<h3>$2</h3>\n')  // Headings level 3
            .replace(/(.*?)## (.*?)(\n|$)/g, '<h2>$2</h2>\n')  // Headings level 2
            .replace(/(.*?)# (.*?)(\n|$)/g, '<h1>$2</h1>\n')  // Headings level 1
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // big text
            .replace(/(\[\d+\])(\s*\1)+/g, '$1');  // remove duplicate citations in the same line

        return responseContent;
    }

    /**
     * Toggles the visibility of the content in the sections when a chevron button is clicked, 
     * changing the chevron icon accordingly.
     */
    document.addEventListener("DOMContentLoaded", function() {
        function toggleContent(button) {
            const contentId = button.getAttribute("data-target");
            const content = document.getElementById(contentId);
            const chevron = button.querySelector("img");
            const heading = button.nextElementSibling;
    
            if (content.style.display === "none" || !content.style.display) {
                content.style.display = "block";
                chevron.src = "ai-tab/img/chevron-down.png"; 
                heading.classList.add("h3-bold");
            } else {
                content.style.display = "none";
                chevron.src = "ai-tab/img/chevron-right.png"; 
                heading.classList.remove("h3-bold"); 
            }
        }

        document.querySelectorAll(".chevron-button").forEach(button => {
            const contentId = button.getAttribute("data-target");
            const content = document.getElementById(contentId);
            const chevron = button.querySelector("img");
            const heading = button.nextElementSibling;
    
            if (contentId === "ai-response-summary") {
                content.style.display = "block";
                chevron.src = "ai-tab/img/chevron-down.png";
                heading.classList.add("h3-bold");
            } else {
                content.style.display = "none";
                chevron.src = "ai-tab/img/chevron-right.png";
                heading.classList.remove("h3-bold");
            }
    
            button.addEventListener("click", function() {
                toggleContent(this);
            });
        });
    }); 
    
    /**
     * Creates a popup displaying the given prompts for user review.
     * @param {string} promptGrowth - Growth prompt content.
     * @param {string} promptHistory - History prompt content.
     */
    function showPromptPopup(promptGrowth, promptHistory) {
        const popup = document.createElement('div');
        const promptDiagnosis = "You have analyzed the data of the patient. Now give me two to three possible diagnoses with the ICD-10 Code.";
        const promptReferral = "If there is a growth abnormality detected, provide a recommendation to which specialist you would refer the patient and for which next clinical steps. Use the attached clinical practice guidelines you referenced before for your justification. Focus on the most important points and cite the source if you use references. Limit yourself to a maximum of 3 bullet points.";
        const promptSummary = "Create an executive summary of your analysis. Use the attached files you referenced before for your justification. Limit yourself to a maximum of 3 bullet points.";
        if (promptHistory == "No historical data available. Answer with 'No historical data for this patient available.'") {
            promptHistory == 'No historical data for this patient available.';
        }
        popup.id = 'prompt-popup';
        popup.innerHTML = `
            <div class="popup-content">
                <span class="close-button-Prompt">&times;</span>
                    <pre class="prompt-header">General Instruction</pre>
                    <pre>You are a highly qualified pediatrician whose task it is to analyze a patient's data and make a diagnosis. Answer concisely and specifically in bullet points.</pre>
                    <br>
                    <pre class="prompt-header">Prompt 1: Growth Abnormalities</pre>
                    <pre class="promptSpecial">${promptGrowth}</pre>
                    <br>
                    <pre class="prompt-header">Prompt 2: Patient History </pre>
                    <pre class="promptSpecial">${promptHistory}</pre>
                    <br>
                    <pre class="prompt-header">Prompt 3: Specialist Referral</pre>
                    <pre>${promptReferral}</pre>
                    <br>
                    <pre class="prompt-header">Prompt 4: Differential Diagnosis</pre>
                    <pre>${promptDiagnosis}</pre>
                    <br>
                    <pre class="prompt-header">Prompt 5: Executive Summary</pre>
                    <pre>${promptSummary}</pre>
            </div>
        `;
        document.body.appendChild(popup);

        document.querySelector('.close-button-Prompt').addEventListener('click', function() {
            document.body.removeChild(popup);
        });

        popup.addEventListener('click', function(event) {
            if (event.target === popup) {
                document.body.removeChild(popup);
            }
        });
    }

    /**
     * Shows an error popup with the specified message(s).
     * @param {...string} errorMessages - One or more error messages to display.
     */
    function showErrorPopup(...errorMessages) {
        // Concatenate all the error message parts into one string
        const fullErrorMessage = errorMessages.join('');
    
        const popup = document.createElement('div');
        popup.id = 'error-popup';
        const message = document.createElement('p');
        message.textContent = fullErrorMessage;
        popup.appendChild(message);
    
        // Create the close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.id = 'close-popup';
        closeButton.addEventListener('click', function() {
            document.body.removeChild(popup);
        });
    
        popup.appendChild(closeButton);
        document.body.appendChild(popup);
    }

    // Getter to get the growth data from the global patient object GC. 
    // The data is loaded via load-fhir-data.js. The percentiles,  z-scores and velocities are calculated in 
    // js/statistics.js

    /**
     * Retrieves the length or stature of the patient entry, formatted appropriately.
     * @param {Object} entry - The patient entry containing measurement data.
     * @returns {string} - The formatted length/stature value or an empty mark if not available.
     */
    function getLength(entry) {
        if (entry.hasOwnProperty("lengthAndStature")) {
            return GC.Util.format(entry.lengthAndStature, {
                type: "height",
                cmOnly: true,
                separator: '<span class="unit-separator"></span>'
            });
        }
        return EMPTY_MARK;
    }

    /**
     * Retrieves the weight of the patient entry, formatted appropriately.
     * @param {Object} entry - The patient entry containing measurement data.
     * @returns {string} - The formatted weight value or an empty mark if not available.
     */
    function getWeight(entry) {
        if (entry.hasOwnProperty("weight")) {
            return GC.Util.format(entry.weight, {
                type: "weight",
                kgOnly: true,
                separator: '<span class="unit-separator"></span>'
            });
        }
        return EMPTY_MARK;
    }

    /**
     * Retrieves the head circumference of the patient entry, formatted appropriately.
     * @param {Object} entry - The patient entry containing measurement data.
     * @returns {string} - The formatted head circumference value or an empty mark if not available.
     */
    function getHeadC(entry) {
        if (entry.hasOwnProperty("headc")) {
            return GC.Util.format(entry.headc, {
                type: "headc",
                cmOnly: true
            });
        }
        return EMPTY_MARK;
    }

    /**
     * Retrieves the BMI of the patient entry, formatted appropriately.
     * @param {Object} entry - The patient entry containing measurement data.
     * @returns {string} - The formatted BMI value or an empty mark if not available.
     */
    function getBMI(entry) {
        if (entry.hasOwnProperty("bmi")) {
            return GC.Util.format(entry.bmi, {
                type: "bmi",
                unitMetric: "",
                initImp: ""
            });
        }
        return EMPTY_MARK;
    }

    /**
     * Calculates the percentile for a given property of the patient entry.
     * @param {Object} entry - The patient entry containing measurement data.
     * @param {string} prop - The property for which the percentile is calculated.
     * @returns {string|number} - The calculated percentile value rounded to precision or an empty mark if unavailable.
     */
    function getPercentile(entry, prop) {
        if (entry.hasOwnProperty(prop)) {
            var ds = getDataSet(prop), pct;
            if (ds) {
                pct = GC.findPercentileFromX(
                    entry[prop],
                    ds,
                    GC.App.getGender(),
                    entry.agemos
                );
                if (isNaN(pct) || !isFinite(pct)) {
                    return EMPTY_MARK;
                }
                return GC.Util.roundToPrecision(pct * 100, 0);
            }
        }
        return EMPTY_MARK;
    }
    
    /**
     * Calculates the Z-score for a given property of the patient entry.
     * @param {Object} entry - The patient entry containing measurement data.
     * @param {string} prop - The property for which the Z-score is calculated.
     * @returns {string|number} - The calculated Z-score value rounded to precision or an empty mark if unavailable.
     */
    function getZScore(entry, prop) {
        if (entry.hasOwnProperty(prop)) {
            var ds = getDataSet(prop), z;
            if (ds) {
                z = GC.findZFromX(
                    entry[prop],
                    ds,
                    GC.App.getGender(),
                    entry.agemos
                );
                if (isNaN(z) || !isFinite(z)) {
                    return EMPTY_MARK;
                }
                return GC.Util.roundToPrecision(z, 1);
            }
        }
        return EMPTY_MARK;
    }
    
    /**
     * Calculates the growth velocity for a given property of the patient entry.
     * @param {Object} entry - The patient entry containing measurement data.
     * @param {string} prop - The property for which the growth velocity is calculated.
     * @returns {string|number} - The calculated velocity or an empty mark if unavailable.
     */
    function getVelocity(entry, prop) {
        if (entry.hasOwnProperty(prop)) {
            const prev = GC.App.getPatient().getPrevModelEntry(entry.agemos, function(o) {
                return o.hasOwnProperty(prop);
            });
            if (prev) {
                const v = GC.App.getPatient().getVelocity(prop, entry, prev);
                if (v.value) {
                    let tmp = GC.Util.format(v.value, { type: prop });
    
                    if (tmp && GC.chartSettings.roundPrecision.velocity[GC.chartSettings.nicu ? "nicu" : "std"] === "auto") {
                        tmp += v.suffix;
                    } else {
                        tmp = GC.Util.floatVal(tmp);
                    }
    
                    if (tmp) {
                        return tmp;
                    }
                }
            }
        }
        return EMPTY_MARK;
    }

    /**
     * Retrieves the entry date for a specific index from the patient model data.
     * @param {number} index - The index of the entry in the patient model data.
     * @returns {string} - The formatted date string or an empty mark if data is unavailable or invalid.
     */
    function getEntryDate(index) {
        var patient = GC.App.getPatient(),
            model = patient.getModel(),
            lastDate;

        if (!patient || !model) {
            console.error("Patient data or model is not available.");
            return EMPTY_MARK;
        }

        if (index >= model.length) {
            console.error("Index out of range.");
            return EMPTY_MARK;
        }

        var data = model[index];

        // Ensure patient.DOB and data.agemos are available
        if (!patient.DOB || data.agemos === undefined) {
            console.error("Missing necessary patient data for entry " + (index + 1));
            return EMPTY_MARK;
        }

        // Calculate the age and date for each entry
        var date = new XDate(patient.DOB.getTime()).addMonths(data.agemos),
            sameDay = lastDate && lastDate.diffDays(date) < 1,
            dateText = sameDay ?
                '•' :
                date.toString(GC.chartSettings.dateFormat);

        lastDate = date;
        return dateText;
    }
    
    /**
     * Retrieves the appropriate dataset for the specified type of measurement.
     * @param {string} type - The type of measurement (e.g., "length", "weight", "headc").
     * @returns {Object} - The dataset corresponding to the specified measurement type.
     */
    function getDataSet(type) {
        var ds = GC.App.getPrimaryChartType();
        switch (type.toLowerCase()) {
        case "length":
        case "stature":
        case "lengthandstature":
            return GC.DATA_SETS[ds + "_STATURE"] || GC.DATA_SETS[ds + "_LENGTH"];
        case "weight":
            return GC.DATA_SETS[ds + "_WEIGHT"];
        case "headc":
            return GC.DATA_SETS[ds + "_HEADC"];
        }
    }

    // Exported functions for use in the tests --> remove comments before starting the tests
    /*module.exports = {
        sendToAssistant, getAssistant, getCitationNumber, updateCitations, getFiles, displayFiles,
        setupDownloadButtons, initiateDownload, createMessage,  runAssistant, displayAssistantResponse
    };*/
}(GC, jQuery));


