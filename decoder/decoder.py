import socketio
import torch
import torchvision
from torchvision import datasets, transforms, models, utils
import os
import cv2
import segmentation_models_pytorch as smp
from qreader import QReader
import requests
from pathlib import Path

SSL_VERIFY = False
SERVER_IP = "localhost:3002"

qreader = QReader()
device = "cuda" if torch.cuda.is_available() else "cpu"
emptyImage = True
print(torch.cuda.is_available())

# Load Model
model = smp.Unet(
    encoder_name="tu-efficientnetv2_m",        # choose encoder, e.g. mobilenet_v2 or efficientnet-b7 # timm-efficientnet-b2	
    encoder_weights=None,#"imagenet",     # use `imagenet` pretreined weights for encoder initialization
    in_channels=3,                  # model input channels (1 for grayscale images, 3 for RGB, etc.)
    classes=1,                      # model output channels (number of classes in your dataset)
)

model = model.to(device)
checkpoint = './checkpoints/my_checkpoint.pth.tar'
model.load_state_dict(torch.load(checkpoint, map_location=torch.device(device))["state_dict"])
model.eval()

# Listen for SocketIO emits
with socketio.SimpleClient(ssl_verify=SSL_VERIFY) as sio:
    sio.connect("https://" +SERVER_IP)

    while True:
        event = sio.receive()

        # On startImageProcess event decode image
        if(event[0] == "startImageProcess" ):
            emptyImage = True

            # Make sure the image got uploaded 
            while emptyImage:
                my_file = Path("../uploads/" + event[1] +".png")
                if my_file.exists():
                    emptyImage = False
                    try: 
                        # Load image
                        image = cv2.imread("../uploads/" + event[1] +".png")
                        pred_image = cv2.cvtColor(image,cv2.COLOR_BGRA2RGB)

                        # Convert to tensor
                        tensor_img = transforms.ToTensor()(cv2.resize(pred_image, (pred_image.shape[1] - pred_image.shape[1]%32, pred_image.shape[0] - pred_image.shape[0]%32)))

                        x = tensor_img.to(device=device).unsqueeze(0)
                        with torch.no_grad():
                                    preds = torch.sigmoid(model(x))
                                    preds = (preds > 0.5).float()
                                    torchvision.utils.save_image(
                                    preds, f"./temp/temp_pred.png"
                                )

                        # Save prediction            
                        pred_image = cv2.imread("./temp/temp_pred.png")
                        # Decode from prediction image
                        decoded_text = qreader.detect_and_decode(image=pred_image)
                        if(decoded_text == ()):
                            # if that fails try to decode the src image
                            decoded_text = qreader.detect_and_decode(image=image)

                        # Notify Server about results
                        api_url = "https://" + SERVER_IP + "/api/client/results"
                        requests.post(api_url, json={"imageName": event[1], "marker": decoded_text}, verify=SSL_VERIFY)
                    except:
                        emptyImage = True
                        print("error")