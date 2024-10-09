"""
FHIR Resource Creation Script

This script is designed to interact with the Logica FHIR server for the purpose of creating 
a batch of FHIR resources for a patient such as observations, etc.

Author: Simon Moedinger
Date: 10/10/2024
"""
import requests
import json

def create_resources_from_file(access_token, filename):
    """ 
        Creates FHIR resources based on data from a JSON file.
        
        Parameters:
            - access_token (str): The API access token required for authentication.
            - filename (str): The path to the JSON file containing the FHIR resources data.
        
        The function reads the JSON file, sends a POST request to the FHIR API, and logs the outcome.
    """
    url = "https://api.logicahealth.org/test1thesis/data" 
    headers = {
        'Authorization': 'Bearer ' + access_token,
        'Content-Type': 'application/json'
    }
    
    with open(filename, 'r') as file:
        payload = json.load(file)
    
    # Send request 
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code == 200 or response.status_code == 201:
        print("Batch of resources created successfully.")
        print(response.json())
    else:
        print("Failed to create batch of resources.")
        print("Status code:", response.status_code)
        print("Response:", response.text)

# Get the access token via inspect logica login (http://127.0.0.1:8080/launch.html): token > Preview > access_token
access_token="eyJqa3UiOiJodHRwczpcL1wvYXV0aC5sb2dpY2FoZWFsdGgub3JnXC9qd2siLCJraWQiOiJyc2ExIiwidHlwIjoiSldUIiwiYWxnIjoiUlMyNTYifQ.eyJhdWQiOiJzYW5kX21hbiIsImlzcyI6Imh0dHBzOlwvXC9hdXRoLmxvZ2ljYWhlYWx0aC5vcmdcLyIsImV4cCI6MTcyNTk1NDAxNCwiaWF0IjoxNzI1ODY3NjE0LCJqdGkiOiJlOGVkZDRhOS03NmJiLTRhYjctYTAwZC1jY2EwMmYzMzQ0ZjUifQ.iBUlvhf4bZF6N_xRKwivf_COIAh0dn-fCpbrd8ISkAiIZWJnS81FJlPl-yqPBSEVaZ9KMOz6FHipm3XegxsjFgIFMmnNBiez5FOsXzVL4tBomToKLhzGsB72h3a9_ICBxe-FtCQJDQ9fb65ki-XVk0HBr8FOWpj-W5ha6Qv62A-DCmo5Mm8rTxwjn7BX5q1v2PYCQdcmtrlmYyR3P9id5HH3cah475oHK66irXoRubE0kFRNyAlh2WrQL8gs8ARib-FGRun6VypyoOdYCgj708ALkMkByqElRxyFK15oThJ4KGtwneAx2TEtpXFUFA0rzpo2T0SzPCXvlzeagSHVUA"


# path to your json patient file with the resources
create_resources_from_file(access_token, 'ai-tab/fixtures/patients/healthy-heinz-history.json')

