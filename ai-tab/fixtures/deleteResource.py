"""
FHIR Patient and Resource Deletion Script

This script is designed to interact with the Logica FHIR server for the purpose of creating 
a batch of FHIR resources for a patient such as observations, etc.

Author: Simon Moedinger
Date: 10/10/2024
"""
import requests

server_url = "https://api.logicahealth.org/test1thesis/data" 
# Get the access token via inspect logica login (http://127.0.0.1:8080/launch.html): token > Preview > access_token
access_token = "eyJqa3UiOiJodHRwczpcL1wvYXV0aC5sb2dpY2FoZWFsdGgub3JnXC9qd2siLCJraWQiOiJyc2ExIiwidHlwIjoiSldUIiwiYWxnIjoiUlMyNTYifQ.eyJhdWQiOiJzYW5kX21hbiIsImlzcyI6Imh0dHBzOlwvXC9hdXRoLmxvZ2ljYWhlYWx0aC5vcmdcLyIsImV4cCI6MTcxNzY5NjY2MCwiaWF0IjoxNzE3NjEwMjYwLCJqdGkiOiI3OGZjZjE0ZC03MzNjLTQwMTEtOWExOC0zZGQ4YWQzMjE0ZjcifQ.FJSVPH51oB7DxFmzY964DDRj1RgVLNfezQkQ5G1fzdBKeNyOwdz7_Go4k7KZNrZ8GEz1zLYI0QjiivKmgXhpXmMo0MqtYsX_ABKqFQlz25Gek-QiwXJ1qd2urPfhOP-_1ZTCXkpHR6df_F5XSiFOe8bmBQkAy3MI0uXZC3Sjgay0O3zOjBlE-yjsY_C6uw7qUadIAToGhEnmze3Zb2cW8o9EkXqIikejtfq79qu3os7sXPr4fk4Dwj78xeKHgPTqlxzsNk3BZHLrYvu4K9eluAK5MsWn3rJ8UliTQMnH70rHHMX-pcPTmzEiPUj_ZCLkBkk-TCaZBjGEaLRMrshRog"

headers = {
        'Authorization': 'Bearer ' + access_token,
        'Content-Type': 'application/json'
    }

def delete_resource(resource_type, resource_id, cascade=False):
    """ Function to delete a resource by type and ID, with optional cascading 
    Parameters:
            - resource_type (str): The type of FHIR resource (e.g., 'Patient', 'Observation').
            - resource_id (str): The unique identifier of the resource to be deleted.
            - cascade=Boolean: Cascade True or False
         Returns:
            - tuple: HTTP status code and the response text from the server.
    """
    url = f"{server_url}/{resource_type}/{resource_id}"
    if cascade and resource_type == 'Patient':
        url += "?_cascade=delete" 
    response = requests.delete(url, headers=headers)
    return response.status_code, response.text


def cascade_delete_patient(patient_id):
    """ Function to delete a patient with cascading
        Parameters:
         - patient_id (str): The unique identifier of the patient to be deleted. Can be found in Logica
        
        Prints the status and response from the server after attempting to delete the patient.
    """
    status, text = delete_resource('Patient', patient_id, cascade=True)
    print(f"Deleted Patient/{patient_id} with cascading: {status} - {text}")

cascade_delete_patient('346')

""" Curl commands to get all resources, e.g. immunizations with patient id """
# curl -X GET "https://api.logicahealth.org/test1thesis/data/Immunization?patient=Patient/691" \
#   -H "Authorization: Bearer eyJqa3UiOiJodHRwczpcL1wvYXV0aC5sb2dpY2FoZWFsdGgub3JnXC9qd2siLCJraWQiOiJyc2ExIiwidHlwIjoiSldUIiwiYWxnIjoiUlMyNTYifQ.eyJhdWQiOiJzYW5kX21hbiIsImlzcyI6Imh0dHBzOlwvXC9hdXRoLmxvZ2ljYWhlYWx0aC5vcmdcLyIsImV4cCI6MTcyNTk1NDAxNCwiaWF0IjoxNzI1ODY3NjE0LCJqdGkiOiJlOGVkZDRhOS03NmJiLTRhYjctYTAwZC1jY2EwMmYzMzQ0ZjUifQ.iBUlvhf4bZF6N_xRKwivf_COIAh0dn-fCpbrd8ISkAiIZWJnS81FJlPl-yqPBSEVaZ9KMOz6FHipm3XegxsjFgIFMmnNBiez5FOsXzVL4tBomToKLhzGsB72h3a9_ICBxe-FtCQJDQ9fb65ki-XVk0HBr8FOWpj-W5ha6Qv62A-DCmo5Mm8rTxwjn7BX5q1v2PYCQdcmtrlmYyR3P9id5HH3cah475oHK66irXoRubE0kFRNyAlh2WrQL8gs8ARib-FGRun6VypyoOdYCgj708ALkMkByqElRxyFK15oThJ4KGtwneAx2TEtpXFUFA0rzpo2T0SzPCXvlzeagSHVUA"

""" Curl commands to delete one resources, e.g. immunization by resource id """
#curl -X DELETE "https://api.logicahealth.org/test1thesis/data/Immunization/838" \
#   -H "Authorization: Bearer eyJqa3UiOiJodHRwczpcL1wvYXV0aC5sb2dpY2FoZWFsdGgub3JnXC9qd2siLCJraWQiOiJyc2ExIiwidHlwIjoiSldUIiwiYWxnIjoiUlMyNTYifQ.eyJhdWQiOiJzYW5kX21hbiIsImlzcyI6Imh0dHBzOlwvXC9hdXRoLmxvZ2ljYWhlYWx0aC5vcmdcLyIsImV4cCI6MTcyNTc5MDc1NiwiaWF0IjoxNzI1NzA0MzU2LCJqdGkiOiI2YThlNGIzYS0xZTAyLTQ4YWMtOTRkMy03OGNhNDM1NWY0ZTkifQ.JYMMreZyiCFq6mm98aCAK5B43DeoqVjCqnGqogLB7GJ9qjM-RX4-76Mj42f5FAXVuQQs99vUOshmRtPK6Q8N2y7BdwsIz3ZTt1O83YCesX55TiXMIv7QELEQZn9dRIyzee1LR6R_30JO5bFBnb47Sz0kxlERM7KhJKR63whUYg5B57DjaoVy3iC-Olp-Dc9cAedLCwB4Mc3jMo0jxZE3OwpUeMAYEnJcFMALrUdtXMJLjz4BCGjoAQxkrTLaF-yXW7rt737eN9Bb8Ga8MR5geVit0Bzanv522rh4XZl3GCRkahlNyXBvDpgQCfMS_49mBeK3vkbfN36oAd25htQyjg"