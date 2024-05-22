document.addEventListener("DOMContentLoaded", async () => {
  const video = document.querySelector('#video');

  // Dynamically import face-api.js
  const faceapiModule = await import('./face-api.min.js');
  const faceapi = faceapiModule.default;

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('/models')
  ]);

  startVideo();

  async function startVideo() {
    const constraints = { video: true };
    try {
      let stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
      };
    } catch (err) {
      console.error('Error accessing the webcam:', err);
    }
  }

  video.addEventListener('play', () => {
    const canvas = faceapi.createCanvasFromMedia(video);
    document.body.append(canvas);

    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
      const detections = await faceapi.detectAllFaces(
        video,
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceExpressions();

      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
      faceapi.draw.drawDetections(canvas, resizedDetections);
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
      faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
    }, 100);
  });
});
