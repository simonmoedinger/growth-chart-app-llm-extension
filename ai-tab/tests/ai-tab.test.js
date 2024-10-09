/**
 * @jest-environment jsdom
 */

const $ = require('jquery');
global.jQuery = $;

// Define the global GC object before importing gc-ai-summary.js
global.GC = {
    Util: {
        format: jest.fn().mockImplementation((value, options) => value),
        roundToPrecision: jest.fn().mockImplementation((value) => value),
        floatVal: jest.fn().mockImplementation((value) => parseFloat(value))
    },
    App: {
        getGender: jest.fn().mockReturnValue('male'),
        getPatient: jest.fn().mockImplementation(() => ({
            getModel: jest.fn().mockReturnValue([{ agemos: 24 }, { agemos: 36 }]),
            DOB: new Date('2010-01-01'),
            name: 'John Doe',
            gender: 'male',
        })),
        getPrimaryChartType: jest.fn().mockReturnValue('standard')
    },
    DATA_SETS: {
        standard_STATURE: {},
        standard_WEIGHT: {},
        standard_HEADC: {},
    },
    findPercentileFromX: jest.fn().mockReturnValue(0.5),
    findZFromX: jest.fn().mockReturnValue(1.5),
    getPatientHistory: jest.fn().mockResolvedValue([]) // Mock patient history function
};

// Mock XDate
global.XDate = jest.fn().mockImplementation(() => ({
    addMonths: jest.fn().mockReturnValue({
        toString: jest.fn().mockReturnValue('2024-10-01'),
        diffDays: jest.fn().mockReturnValue(0)
    })
}));

// Import the actual functions from the module after defining GC
const { 
    sendToAssistant, 
    getAssistant, 
    getCitationNumber, 
    updateCitations, 
    getFiles, 
    displayFiles, 
    createMessage,
    runAssistant,    
    displayAssistantResponse  
} = require('../js/gc-ai-summary.js');

describe('AI Tab Functions', () => {
    beforeAll(() => {
        // Initialize OpenAI using window.OpenAI
        global.window = {};
        window.OpenAI = jest.fn().mockImplementation(() => ({
            beta: {
                assistants: {
                    retrieve: jest.fn().mockResolvedValue({ id: 'asst_6LEnciXiGknEgzaJKlrssixL' }),
                },
                threads: {
                    create: jest.fn().mockResolvedValue({ id: 'mock-thread-id' }),
                    messages: {
                        create: jest.fn().mockResolvedValue({}),
                        list: jest.fn().mockResolvedValue({
                            data: [{ role: 'assistant', content: [{ text: { value: 'Test response', annotations: [] } }] }],
                        }),
                    },
                    runs: {
                        createAndPoll: jest.fn().mockResolvedValue({ status: 'completed', thread_id: 'mock-thread-id' }),
                    },
                },
            },
        }));

        // Set up the OpenAI client in the global scope
        document.addEventListener('DOMContentLoaded', function() {
            try {
                global.openai = new window.OpenAI({
                    apiKey: 'Mock-Key',
                    dangerouslyAllowBrowser: true
                });

                global.openai.files = {
                    retrieve: jest.fn() // Mock retrieve function for use in tests
                };
    
            } catch (error) {
                console.error('Error initializing OpenAI:', error);
            }
        });
    });

    beforeEach(() => {
        // Clear all mock instances
        jest.clearAllMocks();
        // Mock DOM elements
        document.body.innerHTML = `
            <div id="ai-response-growth-data"></div>
            <div id="ai-response-patient-history"></div>
            <div id="ai-response-growth-diagnoses"></div>
            <div id="ai-response-clinical-steps"></div>
            <div id="ai-response-summary"></div>
            <div id="guideline-files"></div>
            <div class="ai-response-growth"></div>
            <div class="abnormality-warning"></div>
            <div class="check-icon"></div>
            <div id="chat-container">
                <div class="chat-content"></div>
            </div>
        `;
    });

    // Tests the initialization of openai
    test('should initialize OpenAI when DOM content is loaded', () => {
        document.dispatchEvent(new Event('DOMContentLoaded'));
        expect(global.openai).toBeDefined(); // Check if OpenAI is defined
    });

    // Tests the getAssistant function and validates the ID
    test('should call the getAssistant function and validate the ID', async () => {
        document.dispatchEvent(new Event('DOMContentLoaded'));

        try {
            // Call the getAssistant function and check if it returns an assistant ID
            const assistantId = await getAssistant();
            expect(assistantId).toBe('asst_6LEnciXiGknEgzaJKlrssixL');
        } catch (error) {
            console.error(error);
            expect(error).toBeNull(); // Fail if there's an error
        }
    });

    // Tests the sendToAssistant function if a response is in the DOM elements
    test('should call sendToAssistant and update the DOM correctly', async () => {
            document.dispatchEvent(new Event('DOMContentLoaded'));
    
            const promptGrowth = "First, analyze the patients growth parameters to determine whether there is an anomaly in the data. Look at the height, weight and head circumference as well as the z-scores and percentiles. Use the attached clinical practice guidelines as a reference for your justification. Focus on the most important points and limit yourself to a maximum of four bullet points. The patient's name is Lennard Lopez, the sex is male and the date of birth is 2024-03-15. Accordingly, the age today is 6 Months, 3 Weeks. Here are the patient's growth data (oldest measurement first): Entry 1: Date: 15Mar2024 Length (cm): 50cm, Length Percentile (%): 52, Length Z-Score (Z): 0.1, Weight (kg): 3.2kg, Weight Percentile (%): 38, Weight Z-Score (Z): -0.3, Head Circumference (cm): 35cm, Head Circumference Percentile (%): 66, Head Circumference Z-Score (Z): 0.4 Entry 2: Date: 14Apr2024 Length (cm): 54cm, Length Percentile (%): 39, Length Z-Score (Z): -0.3, Length Velocity (cm/yr): 49.6, Weight (kg): 4kg, Weight Percentile (%): 22, Weight Z-Score (Z): -0.8, Weight Velocity (kg/yr): 9.9, Head Circumference (cm): 37cm, Head Circumference Percentile (%): 44, Head Circumference Z-Score (Z): -0.2, Head Circumference Velocity (cm/yr): 24.8 Entry 3: Date: 15May2024 Length (cm): 57cm, Length Percentile (%): 26, Length Z-Score (Z): -0.7, Length Velocity (cm/yr): 36, Weight (kg): 4.8kg, Weight Percentile (%): 13, Weight Z-Score (Z): -1.1, Weight Velocity (kg/yr): 9.6, Head Circumference (cm): 39cm, Head Circumference Percentile (%): 48, Head Circumference Z-Score (Z): -0.1, Head Circumference Velocity (cm/yr): 24 Entry 4: Date: 13Jun2024Length (cm): 59cm, Length Percentile (%): 14, Length Z-Score (Z): -1.1, Length Velocity (cm/yr): 24.8, Weight (kg): 4.9kg, Weight Percentile (%): 2, Weight Z-Score (Z): -2.1, Weight Velocity (kg/yr): 1.2, Head Circumference (cm): 40cm, Head Circumference Percentile (%): 36, Head Circumference Z-Score (Z): -0.4, Head Circumference Velocity (cm/yr): 12.4"
            const promptHistory = "Now that you have analyzed the growth data, also analyze the history of the patient and include it in your assessment. Focus on the most important points which could be relevant for the doctor to assess the patients health. Use the attached clinical practice guidelines as a reference for your justification. Describe the results of your analysis in maximum three bullet points and keep your results concise. Here is the history of the patient: Entry 1: Date: 2024-03-15 Details: Immunization: Hepatitis B. Status: completed. Notes: None. Entry 2: Date: 2024-03-15 Details: Observation: Developmental milestones. Value: Grasp reflex observed, random limb movements; Establishes eye contact, crying as communication; Moro reflex and rooting reflex observed . Notes: None.";
    
            // Call getAssistant to ensure the assistant is initialized
            await getAssistant();
        
            try {
                // Call the sendToAssistant function with prompts
                await sendToAssistant(promptGrowth, promptHistory);
        
                // Verify the content of the DOM element for growth response
                     // Check the growth data response
                const growthElement = document.getElementById('ai-response-growth-data');
                expect(growthElement).not.toBeNull();
                expect(growthElement.innerHTML).not.toBe(''); // Ensure it's not empty

                // Verify the content of the other DOM elements updated by the sendToAssistant function
                const historyElement = document.getElementById('ai-response-patient-history');
                expect(historyElement).not.toBeNull();
                expect(historyElement.innerHTML).not.toBe('');
        
                const diagnosisElement = document.getElementById('ai-response-growth-diagnoses');
                expect(diagnosisElement).not.toBeNull();
                expect(diagnosisElement.innerHTML).not.toBe('');
        
                const clinicalStepsElement = document.getElementById('ai-response-clinical-steps');
                expect(clinicalStepsElement).not.toBeNull();
                expect(clinicalStepsElement.innerHTML).not.toBe('');
        
                const summaryElement = document.getElementById('ai-response-summary');
                console.log('Summary Element Content:', summaryElement.innerHTML);
                expect(summaryElement).not.toBeNull();
                expect(summaryElement.innerHTML).not.toBe('');
            } catch (error) {
                console.error(error);
                expect(error).toBeNull(); // Ensure there's no error
            }
        });

        
    // Test to get citation number
    test('getCitationNumber should assign and retrieve citation numbers correctly', () => {
        const fileId1 = 'file1';
        const fileId2 = 'file2';

        const firstCitation = getCitationNumber(fileId1);
        expect(firstCitation).toBe(1);

        const secondCitation = getCitationNumber(fileId2);
        expect(secondCitation).toBe(2);

        expect(getCitationNumber(fileId1)).toBe(1);
    });

    // Test to update the citation number
    test('updateCitations should correctly update content with citation numbers', () => {
        const content = "This is a test [file].";
        const annotations = [
            { file_citation: { file_id: 'file1' }, text: '[file]' }
        ];

        const updatedContent = updateCitations(content, annotations);
        expect(updatedContent).toBe("This is a test  [1].");
    });

    // Test of getFiles function
    test('getFiles should handle errors gracefully and return an empty array', async () => {
        const annotations = [
            { file_citation: { file_id: 'file1' } }
        ];

        global.openai.files.retrieve = jest.fn().mockRejectedValue(new Error('Error retrieving file'));

        const files = await getFiles(annotations);
        expect(files).toEqual([]);
    });

    // Test to display the files and update the DOM
    test('displayFiles should update the DOM with new files', () => {
        const files = [
            { id: 'file1', name: 'file1.pdf', citationIndex: 1 },
            { id: 'file2', name: 'file2.pdf', citationIndex: 2 }
        ];

        displayFiles(files);

        const guidelineFilesDiv = document.getElementById('guideline-files');
        expect(guidelineFilesDiv.children.length).toBe(2);
        expect(guidelineFilesDiv.children[0].textContent).toContain('file1.pdf [1]');
        expect(guidelineFilesDiv.children[1].textContent).toContain('file2.pdf [2]');
    });
});
