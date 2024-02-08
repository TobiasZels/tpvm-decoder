
#!/usr/bin/python
"""
This script receives data from the node server and writes it into the FIFO for picom to dynamicly change the
required scenarios for the study.

Usage: studyScript.py -s server_adress
"""

import sys
import os
import argparse

import socketio


# FIFO path make sure that it outputs the file in the right directory for picom
FIFO_PATH = "../studyfifo"

# Arguments
argParser = argparse.ArgumentParser()
argParser.add_argument("-s", "--server", help="Server Adress")
args = argParser.parse_args()

serverAdress = args.server

stopCommand = False

# Scenarios, make sure they are the same order as in server.js
AVAILABLE_PAYLOADS= ['2','20', '200']
AVAILABLE_MAKER = ['aruco', 'dotcode', 'qr']
AVAILABLE_SCENARIOS = ['text_d', 'text_w', 'image']

# The most recent payload
payload = ""
marker = ""
scenario = ""

### FUNCTIONS ###
# Converts the data to the right format
def send_data(marker, scenarios, payload):
    hashmap = {"marker": marker, "scenarios": scenarios, "payload": payload}
    hashmap_data = "\n".join([f"{key}:{value}" for key, value in hashmap.items()])

    write_to_fifo(hashmap_data)

# Writes the data to FIFO 
def write_to_fifo(data):
    try:
        fifo = open(FIFO_PATH, "w")
        fifo.write(data)
        fifo.close()
        print("success")
    except FileNotFoundError:
        print("FIFO not found")

### ###

### MAIN ###
# Makes sure the client is properly disconnected after use
# ssl_verify = False is required to connect to self signed SSL connections or it throws an error
with socketio.SimpleClient(ssl_verify=False) as sio:
    sio.connect("https://" + serverAdress)

    # Right now basicly an endless loop, possible to stop it from the server in the future but no real use for that right now
    while not stopCommand:
        event = sio.receive()

        # Sets the Scenario from the set_scenario broadcast, we only need the marker and scenario for the client pc which is in position 5 and 6 (4,5)
        # in the testArray
        if event[0] == "set_scenario":
            marker = AVAILABLE_MAKER[event[1][4]]
            scenario = AVAILABLE_SCENARIOS[event[1][5]]
        # Sets the Payload, size doesnt matter we only need the payload
        elif event[0] == "payload":
            payload = event[1]

        # This point is only reached once an event got received, so only once data changed, we now only need to send the data to the FIFO
        send_data(marker, scenario, payload)

### ###