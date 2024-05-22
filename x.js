let webcamVideo = document.getElementById("webcamVideo");
let model;
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

const accessCamera = () => {
  navigator.mediaDevices
    .getUserMedia({
      video: { width: 320, height: 400 },
      audio: false,
    })
    .then((stream) => {
      webcamVideo.srcObject = stream;
    });
};

const detectFaces = async () => {
  const prediction = await model.estimateFaces(webcamVideo, false);

  // Usando canvas para desenhar o vídeo primeiro
  ctx.drawImage(webcamVideo, 0, 0, 320, 400);

  prediction.forEach((predictions) => {
    // Desenhando um retângulo que detecta o rosto
    ctx.beginPath();
    ctx.lineWidth = "4";
    ctx.strokeStyle = "red";
    ctx.rect(
      predictions.topLeft[0],
      predictions.topLeft[1],
      predictions.bottomRight[0] - predictions.topLeft[0],
      predictions.bottomRight[1] - predictions.topLeft[1]
    );
    ctx.stroke();
    // sound.play();
  });
};

accessCamera();
webcamVideo.addEventListener("loadeddata", async () => {
  model = await blazeface.load();
  // Chamando detectFaces 40 vezes por segundo
  setInterval(detectFaces, 40);
});
