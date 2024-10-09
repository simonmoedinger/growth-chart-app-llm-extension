/**
 * This module is fetching and processing the patient history of the selected patient and returns all resources
 * chronologically ordered for further usage.
 * 
 * - Condition: A condition resource contains the result of a doctor's assessment, for example a diagnosis.
 * - MedicationRequest: This resource represents the order for a medication, regardless of whether it was ordered on an inpatient or outpatient basis.
 * - Procedure: This resource is used for actions such as operations.
 * - AllergyIntolerance: An allergy or intolerance of the patient.
 * - Immunization: An existing vaccination.
 * - Observations: Used for any oberservation such as laboratory results like blood values, etc. (No growth values here).
 * 
 * Dependencies:
 * - Global variables: GC, $, FHIR, XDate, Promise
 *
 * Author: Simon Moedinger
 * Date: 10/10/2024
 * 
 */

window.GC = window.GC || {};

/**
 * Fetches and processes the patient's medical history using SMART on FHIR.
 * Retrieves various FHIR resources and processes them into a chronological format.
 * @returns {Promise<Array>} - A Promise resolving to an array of structured patient history data.
 */
GC.getPatientHistory = function() {
    var _client;
    // Data loading ------------------------------------------------------------

    /**
     * Fetches condition resources for the patient. https://build.fhir.org/condition.html
     * @param {Object} client - FHIR client instance used for API requests.
     * @returns {Promise<Array>} - A Promise resolving to an array of condition resources or an empty array if an error occurs.
     */
    function fetchConditions(client) {
        var query = new URLSearchParams();
        query.set("patient", client.patient.id);
        query.set("_count", 100);
        return client.request("Condition?" + query, {
            pageLimit: 0,
            flat: true
        }).catch(function(error) {
            return [];
        });
    }
    
    /**
     * Fetches medication request resources for the patient. https://build.fhir.org/medicationrequest.html
     * @param {Object} client - FHIR client instance.
     * @returns {Promise<Array>} - A Promise resolving to an array of medication request resources or an empty array if an error occurs.
     */
    function fetchMedications(client) {
        var query = new URLSearchParams();
        query.set("patient", client.patient.id);
        query.set("_count", 100);
        return client.request("MedicationRequest?" + query, {
            pageLimit: 0,
            flat: true
        }).catch(function(error) {
            return [];
        });
    }
    
    /**
     * Fetches procedure resources for the patient. https://build.fhir.org/procedure.html
     * @param {Object} client - FHIR client instance.
     * @returns {Promise<Array>} - A Promise resolving to an array of procedure resources or an empty array if an error occurs.
     */
    function fetchProcedures(client) {
        var query = new URLSearchParams();
        query.set("patient", client.patient.id);
        query.set("_count", 100);
        return client.request("Procedure?" + query, {
            pageLimit: 0,
            flat: true
        }).catch(function(error) {
            return [];
        });
    }
    
    /**
     * Fetches allergy intolerance resources for the patient. https://build.fhir.org/allergyintolerance.html
     * @param {Object} client - FHIR client instance.
     * @returns {Promise<Array>} - A Promise resolving to an array of allergy intolerance resources or an empty array if an error occurs.
     */
    function fetchAllergies(client) {
        var query = new URLSearchParams();
        query.set("patient", client.patient.id);
        query.set("_count", 100);
        return client.request("AllergyIntolerance?" + query, {
            pageLimit: 0,
            flat: true
        }).catch(function(error) {
            return [];
        });
    }
    
    /**
     * Fetches immunization resources for the patient. https://build.fhir.org/immunization.html
     * @param {Object} client - FHIR client instance.
     * @returns {Promise<Array>} - A Promise resolving to an array of immunization resources or an empty array if an error occurs.
     */
    function fetchImmunizations(client) {
        var query = new URLSearchParams();
        query.set("patient", client.patient.id);
        query.set("_count", 100);
        return client.request("Immunization?" + query, {
            pageLimit: 0,
            flat: true
        }).catch(function(error) {
            return [];
        });
    }

    /**
     * Fetches observation resources for the patient, excluding specific LOINC codes. https://www.hl7.org/fhir/observation.html
     * @param {Object} client - FHIR client instance.
     * @returns {Promise<Array>} - A Promise resolving to an array of observation resources or an empty array if an error occurs.
     */
    function fetchObservations(client) {
        var query = new URLSearchParams();
        query.set("patient", client.patient.id);
        query.set("_count", 100);

        // Exclude certain LOINC codes directly in the query, because they are loaded in load-fhir-data.js
        var excludeCodes = [
            'http://loinc.org|29463-7', // weight
            'http://loinc.org|3141-9' , // weight
            'http://loinc.org|8302-2' , // Body height
            'http://loinc.org|8306-3' , // Body height --lying
            'http://loinc.org|8287-5' , // headC
            'http://loinc.org|39156-5', // BMI 39156-5
            'http://loinc.org|18185-9', // gestAge
            'http://loinc.org|37362-1', // bone age
            'http://loinc.org|11884-4'  // gestAge
        ];

        // Add each exclude code as a separate code:not parameter
        excludeCodes.forEach(code => query.append("code:not", code));
        
        return client.request("Observation?" + query.toString(), {
            pageLimit: 0,
            flat: true
        }).catch(function(error) {
            return [];
        });
    }

    // Data parsing ------------------------------------------------------------
    /**
     * Converts and processes condition resources into a structured format.
     * @param {Array} conditions - Array of raw condition resources.
     * @returns {Array} - Array of structured condition objects.
     */
    function processConditions(conditions) {
        return conditions.map(condition => {
            const codeText = (condition.code && condition.code.coding && condition.code.coding.length > 0 && condition.code.coding[0].display) || "unknown";
    
            return {
                resourceType: "Condition",
                id: condition.id,
                clinicalStatus: condition.clinicalStatus ? condition.clinicalStatus.coding[0].display : "unknown",
                verificationStatus: condition.verificationStatus ? condition.verificationStatus.coding[0].display : "unknown",
                code: codeText,
                description: condition.description || "No description available",
                notes: condition.notes || "None",
                timestamp: condition.onsetDateTime || "unknown",
                data: `Condition: ${codeText}. Clinical status: ${condition.clinicalStatus ? condition.clinicalStatus.coding[0].display : "unknown"}, verification status: ${condition.verificationStatus ? condition.verificationStatus.coding[0].display : "unknown"}. Description: ${condition.description || "None"}. Notes: ${condition.notes || "None"}.`
            };
        });
    }

    /**
     * Converts and processes medication resources into a structured format.
     * @param {Array} medications - Array of raw condition resources.
     * @returns {Array} - Array of structured medication objects.
     */
    function processMedications(medications) {
        return medications.map(med => ({
            resourceType: "MedicationStatement",
            id: med.id,
            medicationCodeableConcept: med.medicationCodeableConcept ? med.medicationCodeableConcept.text : "unknown",
            dosage: med.dosage ? med.dosage.map(dose => ({
                text: dose.text || "unknown",
                route: dose.route ? dose.route.coding[0].display : "unknown"
            })) : [],
            reason: med.reasonCode ? med.reasonCode.map(reason => reason.text).join(", ") : "No specific reason provided",
            notes: med.notes || "None",
            effectivePeriod: med.effectivePeriod || "unknown",
            timestamp: med.effectivePeriod ? med.effectivePeriod.start : "unknown",
            data: `MedicationStatement: ${med.medicationCodeableConcept ? med.medicationCodeableConcept.text : "unknown medication"}. Dosage: ${med.dosage ? med.dosage.map(dose => `${dose.text} via ${dose.route ? dose.route.coding[0].display : "unknown route"}`).join(", ") : "unknown"}. Reason: ${med.reasonCode ? med.reasonCode.map(reason => reason.text).join(", ") : "None"}. Notes: ${med.notes || "None"}.`
        }));
    }

    /**
     * Converts and processes procedures resources into a structured format.
     * @param {Array} procedures - Array of raw condition resources.
     * @returns {Array} - Array of structured procedure objects.
     */
    function processProcedures(procedures) {
        return procedures.map(proc => ({
            resourceType: "Procedure",
            id: proc.id,
            code: proc.code ? proc.code.coding[0].display : "unknown",
            reason: proc.reasonCode ? proc.reasonCode.map(reason => reason.text).join(", ") : "No specific reason provided",
            notes: proc.notes || "None",
            timestamp: proc.performedDateTime || proc.effectiveDateTime || "unknown",
            data: `Procedure: ${proc.code ? proc.code.coding[0].display : "unknown procedure"}. Reason: ${proc.reasonCode ? proc.reasonCode.map(reason => reason.text).join(", ") : "None"}. Notes: ${proc.notes || "None"}.`
        }));
    }

    /**
     * Converts and processes allergies resources into a structured format.
     * @param {Array} allergies - Array of raw condition resources.
     * @returns {Array} - Array of structured allergie objects.
     */
    function processAllergies(allergies) {
        return allergies.map(allergy => {
            const codeText = (allergy.code && allergy.code.coding && allergy.code.coding.length > 0 && allergy.code.coding[0].display) || "unknown";
            
            return {
                resourceType: "AllergyIntolerance",
                id: allergy.id,
                clinicalStatus: allergy.clinicalStatus ? allergy.clinicalStatus.coding[0].display : "unknown",
                verificationStatus: allergy.verificationStatus ? allergy.verificationStatus.coding[0].display : "unknown",
                category: allergy.category ? allergy.category[0] : "unknown",
                criticality: allergy.criticality || "unknown",
                code: allergy.code ? allergy.code.text : "unknown",
                reaction: allergy.reaction ? allergy.reaction.map(r => ({
                    substance: r.substance ? r.substance.text : "unknown",
                    manifestation: r.manifestation ? r.manifestation.map(m => m.text).join(", ") : "unknown",
                    severity: r.severity || "unknown"
                })) : [],
                notes: allergy.notes || "None",
                timestamp: allergy.recordedDate || allergy.effectiveDateTime || "unknown",
                data: `Allergy: ${codeText}. Clinical status: ${allergy.clinicalStatus ? allergy.clinicalStatus.coding[0].display : "unknown"}, verification status: ${allergy.verificationStatus ? allergy.verificationStatus.coding[0].display : "unknown"}. Criticality: ${allergy.criticality || "unknown"}. Reaction: ${allergy.reaction ? allergy.reaction.map(r => `${r.substance ? r.substance.text : "unknown"} with manifestation ${r.manifestation ? r.manifestation.map(m => m.text).join(", ") : "unknown"} and severity ${r.severity || "unknown"}`).join(", ") : "None"}. Notes: ${allergy.notes || "None"}.`
            };
        });
    }

    /**
     * Converts and processes immunizations resources into a structured format.
     * @param {Array} immunizations - Array of raw condition resources.
     * @returns {Array} - Array of structured immunization objects.
     */
    function processImmunizations(immunizations) {
        return immunizations.map(immunization => ({
            resourceType: "Immunization",
            id: immunization.id,
            vaccineCode: immunization.vaccineCode ? immunization.vaccineCode.text : "unknown",
            status: immunization.status || "unknown",
            notes: immunization.notes || "None",
            timestamp: immunization.occurrenceDateTime || immunization.effectiveDateTime || "unknown",  
            data: `Immunization: ${immunization.vaccineCode ? immunization.vaccineCode.text : "unknown"}. Status: ${immunization.status || "unknown"}. Notes: ${immunization.notes || "None"}.`
        }));
    }

    /**
     * Converts and processes observations resources into a structured format.
     * @param {Array} observations - Array of raw condition resources.
     * @returns {Array} - Array of structured observation objects.
     */
    function processObservations(observations) {
        return observations.map(obs => {
            const codeText = (obs.code && obs.code.coding && obs.code.coding.length > 0 && obs.code.coding[0].display) 
                ? obs.code.coding[0].display 
                : "unknown";
    
            // Handle different value types
            const value = obs.valueQuantity 
                ? obs.valueQuantity.value 
                : obs.valueString 
                ? obs.valueString 
                : obs.valueCodeableConcept && obs.valueCodeableConcept.text
                ? obs.valueCodeableConcept.text 
                : "unknown";
    
            const unit = obs.valueQuantity ? obs.valueQuantity.unit : "";
            const notes = obs.notes || "None";
            const timestamp = obs.effectiveDateTime || "unknown";
            
            return {
                resourceType: "Observation",
                id: obs.id,
                code: codeText,
                value: value,
                unit: unit,
                notes: notes,
                timestamp: timestamp,
                data: `Observation: ${codeText}. Value: ${value} ${unit}. Notes: ${notes}.`
            };
        });
    }
    
    /**
     * Fetches all patient data and sorts them chronologically.
     * @param {Object} client - FHIR client instance.
     * @returns {Promise<Array>} - A Promise resolving to an array of sorted patient data records.
     */
    async function getChronologicalData(client) {
        try {
            const [conditions, medications, procedures, allergies, immunizations, observations] = await Promise.all([
                fetchConditions(client).then(processConditions),
                fetchMedications(client).then(processMedications),
                fetchProcedures(client).then(processProcedures),
                fetchAllergies(client).then(processAllergies),
                fetchImmunizations(client).then(processImmunizations),
                fetchObservations(client).then(processObservations)
            ]);
    
            let combinedData = [
                ...conditions,
                ...medications,
                ...procedures,
                ...allergies,
                ...immunizations,
                ...observations
            ];
    
            combinedData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            if (combinedData.length === 0) {
                return [];
            }
            return combinedData;
        } catch (error) {
            return [];
        }
    }

    // init --------------------------------------------------------------------
    /**
     * Initializes the function and retrieves patient data when the SMART context is ready.
     * @param {Object} client - FHIR client instance.
     * @returns {Promise<Array>} - A Promise resolving to the structured patient history data.
     */
    function onReady(client) {
        _client = client;
        if (!client.patient || !client.patient.id) {
            throw new Error(GC.str('STR_Error_NoPatient'));
        }
        return getChronologicalData(client).then(function(data) {
            return data;  // return the patient history data
        });
    }

    return FHIR.oauth2.ready().then(onReady).catch(function(e) {
        if (e.status == 401) {
            if (_client) {
                throw new Error("Your SMART session has expired. Please launch again.");
            }
            throw new Error("App launched without SMART context!");
        }
        throw e;
    });
};
