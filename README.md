Master's Thesis: Extending a Clinical Pediatric Growth Chart App Using a Large Language Model
--------------------------------------------------------------------------------
This project was developed during my master's thesis at Harvard Medical School in cooperation with the University of Heidelberg and Heilbronn University.
The code for the growth chart app is forked from [SMART on FHIR](https://github.com/smart-on-fhir/growth-chart-app/tree/master/js) and extends it with an LLM.


### Overview gc-ai-summary.js
The AI tab module handles various aspects:
  - Initializing the AI tab and setting up event listeners.
  - Retrieving and processing patient data to generate prompts for growth and history analysis.
  - Communicating with the OpenAI assistant for data analysis and recommendations.
  - Handling user interactions through a chat interface, file uploads, and UI toggling.
  - Displaying assistant responses, managing file citations, and handling abnormalities in growth data.

Main Functionality Overview:
1. Initialization and Setup
    - Initializes the AI tab, verifies the presence of the OpenAI client, and sets up event listeners.
    - Displays error messages when issues occur during setup or operation.
  
2. AI Assistant Integration
    - Retrieves the assistant ID from the OpenAI API and sends prompts for analysis.
    - Processes and displays responses, including growth abnormalities, history analysis, clinical recommendations, diagnoses, and summaries.
 
3. Prompt Generation and Data Processing
    - Fetches patient data and generates prompts for growth and history based on available information.
    - Formats responses from the assistant and updates UI elements accordingly.
 
4. File Management and Citations
    - Manages file uploads, displays used files, and sets up download buttons for guidelines.
    - Updates content with citation numbers based on file annotations for consistency and traceability.
 
5. User Interface Handling
    - Handles visibility toggles, chat interactions, and displays popups for growth abnormalities and prompt reviews.
    - Ensures proper formatting and display of data within the AI tab.
 
6. Patient Data Retrieval and Calculations
    - Retrieves specific patient data such as length, weight, head circumference, BMI, percentiles, Z-scores, and growth velocities.
    - Calculates necessary statistics and formats the information for analysis and presentation.
  
Structure:
 - Initialization: `initAITab`, `showErrorPopup`
 - AI Interaction: `getAssistant`, `sendToAssistant`, `createMessage`, `runAssistant`, `displayAssistantResponse`
 - Prompt Creation: `fetchPatientData`, `createPromptGrowth`, `createPromptHistory`, `fetchDataAndSendPrompt`
 - File Handling and Citations: `getCitationNumber`, `updateCitations`, `getFiles`, `displayFiles`, `setupDownloadButtons`, `initiateDownload`
 - User Interface Handling: `showPopupGrowthWarning`, `showChat`, `showPromptPopup`, `toggleContent`
 - Data Retrieval and Calculation: `getLength`, `getWeight`, `getHeadC`, `getBMI`, `getPercentile`, `getZScore`, `getVelocity`, `getEntryDate`, `getDataSet`
 

## Embedding of the AI tab into the Growth Chart App

![](img/architecture.png)

-----------------------------------------------------------------------------
## Folder Structure of the AI Tab
(only new and updated files visible)
```
.
├── growth-chart-app-master/
│   ├── ai-tab/
│   │   ├── css
│   │   │   └── gc-ai-summary-view.css
│   │   ├── fixtures
│   │   │   ├── patients
│   │   │   │   ├── ftt_ethan_johnson.json
│   │   │   │   ├── ftt_hannah_becker.json
│   │   │   │   └── ...
│   │   │   ├── createResource.py
│   │   │   ├── deletePatient.py
│   │   │   └── deleteResource.py
│   │   ├── guidelines
│   │   │   ├── UTD Childhood Obesity.pdf
│   │   │   ├── UTD Failure to thrive.pdf
│   │   │   ├── UTD GH Deficiency.pdf
│   │   │   └── UTD T1DM.pdf
│   │   ├── img
│   │   │   ├── chat-button.png
│   │   │   └── ...
│   │   ├── js
│   │   │   ├── openai
│   │   │   │   ├── bundeled-openai.js
│   │   │   │   └── openai-setup.js
│   │   │   ├── gc-ai-summary.js
│   │   │   └── load-patient-history.js
│   │   └── tests
│   │       └── ai-tab.test.js
│   ├── js
│   │   ├── ...
│   │   ├── gc-app.js
│   │   └── ...
│   └── ...
├── ...
├── index.html
├── launch.html
├── load-fhir-data.js
└── ...
```


-----------------------------------------------------------------------------
## Deployment

Prerequisite: You must have installed node with npm. [Follow this instructions to install node. (I recommend using brew)](https://nodejs.org/en/download/package-manager/current)

0. Run npm:
```
npm install
```

1. Before you run the project insert the OpenAI API key I have sent you per email in gc-ai-summary.js (~line 131)

2. To run the project use 
```
npx http-server
```
3. [Login at Logica Health](https://sandbox.logicahealth.org) to access the SMART FHIR Server with the synthetic patients: 

    3.1 Use the credentials from the email I have sent you:
    -  Email: ""
    - Password: ""

    3.2 Click on "thesis-growth-chart-app"

    3.3 Click on "growth-chart-app" - "launch"

    3.4 Choose a physician

    3.5 Choose a patient, e.g. Jacob Miller

    3.6 Click on "growth-chart-app" < "launch"

    3.7 Click "authorize"

-----------------------------------------------------------------------------
## Tests
The following functions are tested:
-    OpenAI initialization: should initialize OpenAI when DOM content is loaded ✓ 
-    getAssistant: should call the getAssistant function and validate the ID ✓ 
-    sendToAssistant: should call sendToAssistant and update the DOM correctly ✓ 
-    getCitationNumber: should assign and retrieve citation numbers correctly ✓ 
-    updateCitations: should correctly update content with citation numbers ✓ 
-    getFiles: should handle errors gracefully and return an empty array ✓ 
-    displayFiles: should update the DOM with new files ✓  

1. install the JavaScript testing framework jest (https://jestjs.io)
```
npm install jest
```

2. Remove comments at the end of file gc-ai-summary.js before starting the tests

3. Run the tests from the root directory
```
npx jest
```
---
