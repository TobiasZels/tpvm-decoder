
#!/usr/bin/python
"""
This script is not supposed to be run by itself, it will get called by the node server to decode the
marker from the received videos.


Usage: decode.py marker_type location_of_the_video
"""

import sys
import time
import os
import cv2
from cv2 import aruco
import numpy as np
from aspose.barcode import barcoderecognition # libgdiplus is needed by this library

# Alternative library to decode QR codes, open source and might be faster, interesting for final version, but bad for comparision
# in the study
#import pyboof as pb 

# Get the Marker from the arguments to apply the right algorithm for it
marker = sys.argv[1]
# Get the location of the videofiles from the arguments
location = sys.argv[2]

### FUNCTIONS ###
# Waits for the file to be created
def waitForFile(file):
    if os.path.isfile(file):
        pass
    else:
        time.sleep(1)
        waitForFile(file)

### ###

# Run the algorithm for the next video file after the current one is done
# TODO: make it valid for unlimited video files
for iteration in range(5):
    waitForFile(location + "/" + str(iteration) + ".webm")
    video = cv2.VideoCapture(location + "/" + str(iteration) + ".webm")
    count = 0
    # Run the algorithm on every frame of the video
    while video.isOpened():
        ret, frame = video.read()
        
        # Stop the loop after the last frame 
        if not ret:
            break

        ### Uncomment lines below to save the exctracted  frames to the disk ###
        #cv2.imwrite(location + "/frame%d - %d.jpg" % (iteration, count) , frame) 
        #count += 1   
        ### ###

        # Convert the frame to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Apply thresholding 
        thresholded = cv2.equalizeHist(gray)
        thresholded = cv2.blur(thresholded,(12,12))
        alpha = 1.0 # Contrast control (1.0 for no change)
        beta = 0  # Brightness control (0 for no change)
        thresholded = cv2.convertScaleAbs(thresholded, alpha=alpha, beta=beta)

        kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])  # Sharpening kernel
        sharpened_image = cv2.filter2D(thresholded, -1, kernel)

        thresholded = cv2.adaptiveThreshold(thresholded, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 255,4)

        kernel = np.ones((3, 3), np.uint8)  # Kernel for morphological operations
        thresholded = cv2.erode(thresholded, kernel, iterations=1)
        thresholded = cv2.dilate(thresholded, kernel, iterations=1)

        # Save the frame so the aspose reader can read it
        cv2.imwrite("temp/temp.jpg", frame)

        # For the study comparison we used the aspose barcode reader, because it was the only available reader that was able to read
        # dotcode, other readers might offer a better performance in future tests.
        # The Apose reader evaluation version can decode all Marker but returns only 70% of the payload
        # Types: https://docs.aspose.com/barcode/python-net/api-reference/aspose.barcode.barcoderecognition/decodetype/
        if marker == "qr":
            reader = barcoderecognition.BarCodeReader("temp/temp.jpg", barcoderecognition.DecodeType.QR)
            recognized_results = reader.read_bar_codes()
            for barcode in recognized_results:
                print(barcode.code_text) 
                exit()
        elif marker == "dotcode":
            reader = barcoderecognition.BarCodeReader("temp.jpg", barcoderecognition.DecodeType.DOT_CODE)
            recognized_results = reader.read_bar_codes()
            for barcode in recognized_results:
                print(barcode.code_text) 
                exit()
        # Sadly Apose doest support Aruco so we need to use the cv2 detection
        elif marker == "aruco": 
            aruco_dict = aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_250)
            parameters =  aruco.DetectorParameters()
            detector = cv2.aruco.ArucoDetector(aruco_dict, parameters)
            corners, ids, rejectedImgPoints = detector.detectMarkers(thresholded)
            if ids:
                for barcode in ids:
                    print(barcode) 
                    exit()

# Landing here means we didnt detect a marker so we return error and exit the script
print("error")
exit()