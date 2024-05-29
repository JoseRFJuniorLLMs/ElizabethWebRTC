import './style.css';
import firebase from 'firebase/app';
import 'firebase/firestore';
import WaveSurfer from 'wavesurfer.js';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCTf11cszj5rb47Ump2dbM2X8GN4L6nX8M",
  authDomain: "elizabeth-ai.firebaseapp.com",
  projectId: "elizabeth-ai",
  storageBucket: "elizabeth-ai.appspot.com",
  messagingSenderId: "268438859981",
  appId: "1:268438859981:web:19a3f5e373becc1edf7984",
  measurementId: "G-KV0P1910W8"
};

if (!firebase.apps.length) {
firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

const servers = {
iceServers: [
{
urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
},
],
iceCandidatePoolSize: 10,
};

const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;
let wavesurfer = null;
let record = null;

const startButton = document.getElementById('startButton');
const finishCallButton = document.getElementById('finishCallButton');
const logImage = document.getElementById('logImage');
const webcamVideo = document.getElementById('webcamVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startAudioButton = document.getElementById('startAudioButton');
const notificationSound = new Audio('./som.mp3'); // Caminho para o som de notificação

// Função para solicitar permissão para exibir notificações
const requestNotificationPermission = async () => {
if ('Notification' in window) {
const permission = await Notification.requestPermission();
if (permission === 'granted') {
console.log('Notification permission granted.');
}
}
};

 
  // Listener para detecção de novos usuários na sala
  firestore.collection('calls').onSnapshot((snapshot) => {
    if (!snapshot.empty) {
      logImage.style.display = 'block';
      showNotification('Novo Usuário', 'Um novo usuário entrou na sala.');
    } else {
      logImage.style.display = 'none';
    }
  });

  
const createWaveSurfer = () => {
if (wavesurfer) {
wavesurfer.destroy();
}
wavesurfer = WaveSurfer.create({
container: '#localWaveform',
waveColor: 'rgb(33, 150, 243)', // Light Blue from image
progressColor: 'rgb(135, 206, 235)', // Sky Blue
cursorColor: 'rgb(0, 0, 0)',
cursorWidth: 6,
barGap: 3,
barWidth: 2,
barHeight: 3,
barRadius: 100,
autoScroll: true,
autoCenter: true,
interact: true,
dragToSeek: true,
fillParent: true
});

record = wavesurfer.registerPlugin(RecordPlugin.create({ scrollingWaveform: false, renderRecordedAudio: false }));
record.on('record-end', (blob) => {
const container = document.querySelector('#recordings');
const recordedUrl = URL.createObjectURL(blob);

const recordedWaveSurfer = WaveSurfer.create({
container,
waveColor: 'rgb(33, 150, 243)', // Light Blue from image
progressColor: 'rgb(135, 206, 235)', // Sky Blue
cursorColor: 'rgb(0, 0, 0)',
cursorWidth: 6,
barGap: 3,
barWidth: 2,
barHeight: 3,
barRadius: 100,
autoScroll: true,
autoCenter: true,
interact: true,
dragToSeek: true,
mediaControls: true,
autoplay: true,
fillParent: true,
url: recordedUrl
});

const button = container.appendChild(document.createElement('button'));
button.textContent = 'Play';
button.onclick = () => recordedWaveSurfer.playPause();
recordedWaveSurfer.on('pause', () => (button.textContent = 'Play'));
recordedWaveSurfer.on('play', () => (button.textContent = 'Pause'));

const link = container.appendChild(document.createElement('a'));
Object.assign(link, {
href: recordedUrl,
download: 'recording.' + (blob.type.split('/')[1] || 'webm'),
});
link.textContent = 'Download recording';
});

record.on('record-progress', (time) => {
updateProgress(time);
});
};

const updateProgress = (time) => {
const formattedTime = [
Math.floor((time % 3600000) / 60000),
Math.floor((time % 60000) / 1000),
]
.map((v) => (v < 10 ? '0' + v : v)) .join(':'); document.querySelector('#progress').textContent=formattedTime; }; const
    setVolume=(videoElement, volume)=> {
    videoElement.volume = volume;
    };

    const setupControlListeners = () => {
    Object.keys(localControls).forEach(control => {
    if (control !== 'volume') {
    localControls[control].addEventListener('input', applyLocalFilters);
    } else {
    localControls[control].addEventListener('input', () => setVolume(webcamVideo, localControls[control].value));
    }
    });

    Object.keys(remoteControls).forEach(control => {
    if (control !== 'volume') {
    remoteControls[control].addEventListener('input', applyRemoteFilters);
    } else {
    remoteControls[control].addEventListener('input', () => setVolume(remoteVideo, remoteControls[control].value));
    }
    });
    };

    startButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    remoteStream = new MediaStream();

    localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
    remoteStream.addTrack(track);
    });
    };

    webcamVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;

    // Start WaveSurfer for audio visualization
    createWaveSurfer();
    record.startRecording();

    const callsSnapshot = await firestore.collection('calls').get();
    const existingCallDoc = callsSnapshot.docs[0];

    if (existingCallDoc) {
    const callDoc = firestore.collection('calls').doc(existingCallDoc.id);
    const answerCandidates = callDoc.collection('answerCandidates');
    const offerCandidates = callDoc.collection('offerCandidates');

    pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
    };

    const callData = (await callDoc.get()).data();
    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
    };

    await callDoc.update({ answer });

    offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') {
    let data = change.doc.data();
    pc.addIceCandidate(new RTCIceCandidate(data));
    }
    });
    });

    } else {
    const callDoc = firestore.collection('calls').doc();
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');

    pc.onicecandidate = (event) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
    };

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
    };

    await callDoc.set({ offer });

    callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
    const answerDescription = new RTCSessionDescription(data.answer);
    pc.setRemoteDescription(answerDescription);
    }
    });

    answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') {
    const candidate = new RTCIceCandidate(change.doc.data());
    pc.addIceCandidate(candidate);
    }
    });
    });
    }

    finishCallButton.disabled = false;
    startButton.disabled = true;

    startAudioButton.disabled = false;

    createDataChannel(pc);
    };

    startAudioButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    remoteStream = new MediaStream();

    localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
    remoteStream.addTrack(track);
    });
    };

    // Start WaveSurfer for audio visualization
    createWaveSurfer();
    record.startRecording();

    const callsSnapshot = await firestore.collection('calls').get();
    const existingCallDoc = callsSnapshot.docs[0];

    if (existingCallDoc) {
    const callDoc = firestore.collection('calls').doc(existingCallDoc.id);
    const answerCandidates = callDoc.collection('answerCandidates');
    const offerCandidates = callDoc.collection('offerCandidates');

    pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
    };

    const callData = (await callDoc.get()).data();
    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
    };

    await callDoc.update({ answer });

    offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') {
    let data = change.doc.data();
    pc.addIceCandidate(new RTCIceCandidate(data));
    }
    });
    });

    } else {
    const callDoc = firestore.collection('calls').doc();
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');

    pc.onicecandidate = (event) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
    };

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
    };

    await callDoc.set({ offer });

    callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
    const answerDescription = new RTCSessionDescription(data.answer);
    pc.setRemoteDescription(answerDescription);
    }
    });

    answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') {
    const candidate = new RTCIceCandidate(change.doc.data());
    pc.addIceCandidate(candidate);
    }
    });
    });
    }

    finishCallButton.disabled = false;
    startAudioButton.disabled = true;
    createDataChannel(pc);

    };

    finishCallButton.onclick = async () => {
    const callsSnapshot = await firestore.collection('calls').get();
    const batch = firestore.batch();

    callsSnapshot.forEach(doc => {
    batch.delete(doc.ref);
    });

    await batch.commit();
    alert('Call has been finished and all call documents have been deleted.');

    pc.close();
    localStream.getTracks().forEach(track => track.stop());
    remoteStream.getTracks().forEach(track => track.stop());

    finishCallButton.disabled = true;
    startButton.disabled = false;
    startAudioButton.disabled = false;

    if (wavesurfer) {
    wavesurfer.destroy();
    wavesurfer = null;
    }
    };

    // Adicionar listener para detectar quando um novo usuário entra na sala
    firestore.collection('calls').onSnapshot((snapshot) => {
    if (!snapshot.empty) {
    logImage.style.display = 'block';

    // Mostrar notificação e reproduzir som de notificação
    showNotification('Um novo usuário entrou na sala.');
    playNotificationSound();
    } else {
    logImage.style.display = 'none';
    }
    });

    document.querySelector('input[type="checkbox"]').onclick = (e) => {
    scrollingWaveform = e.target.checked;
    createWaveSurfer();
    };

    export let localConnection = null;
    export let remoteConnection = null;
    export let sendChannel = null;
    export let receiveChannel = null;

    export function createConnection() {
    const servers = null;

    localConnection = new RTCPeerConnection(servers);
    localConnection.onicecandidate = e => onIceCandidate(localConnection, e);

    remoteConnection = new RTCPeerConnection(servers);
    remoteConnection.onicecandidate = e => onIceCandidate(remoteConnection, e);
    remoteConnection.ondatachannel = receiveChannelCallback;

    sendChannel = localConnection.createDataChannel('sendDataChannel');
    sendChannel.onopen = onSendChannelStateChange;
    sendChannel.onclose = onSendChannelStateChange;

    localConnection.createOffer()
    .then(offer => localConnection.setLocalDescription(offer))
    .then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
    .then(() => remoteConnection.createAnswer())
    .then(answer => remoteConnection.setLocalDescription(answer))
    .then(() => localConnection.setRemoteDescription(remoteConnection.localDescription));

    document.getElementById('startButton').disabled = true;
    document.getElementById('sendButton').disabled = false;
    document.getElementById('finishCallButton').disabled = false;
    document.getElementById('dataChannelSend').disabled = false;
    }

    export function sendData() {
    const data = document.getElementById('dataChannelSend').value;
    sendChannel.send(data);
    document.getElementById('dataChannelSend').value = '';
    }

    export function closeConnection() {
    localConnection.close();
    remoteConnection.close();
    localConnection = null;
    remoteConnection = null;
    sendChannel = null;
    receiveChannel = null;

    document.getElementById('startButton').disabled = false;
    document.getElementById('sendButton').disabled = true;
    document.getElementById('finishCallButton').disabled = true;
    document.getElementById('dataChannelSend').disabled = true;
    document.getElementById('dataChannelReceive').disabled = true;
    }

    function onIceCandidate(pc, event) {
    if (event.candidate) {
    const otherPc = (pc === localConnection) ? remoteConnection : localConnection;
    otherPc.addIceCandidate(new RTCIceCandidate(event.candidate));
    }
    }

    function receiveChannelCallback(event) {
    receiveChannel = event.channel;
    receiveChannel.onmessage = onReceiveMessageCallback;
    receiveChannel.onopen = onReceiveChannelStateChange;
    receiveChannel.onclose = onReceiveChannelStateChange;
    }

    function onReceiveMessageCallback(event) {
    document.getElementById('dataChannelReceive').value = event.data;
    }

    function onSendChannelStateChange() {
    const readyState = sendChannel.readyState;
    if (readyState === 'open') {
    document.getElementById('dataChannelSend').disabled = false;
    document.getElementById('dataChannelSend').focus();
    document.getElementById('sendButton').disabled = false;
    document.getElementById('finishCallButton').disabled = false;
    } else {
    document.getElementById('dataChannelSend').disabled = true;
    document.getElementById('sendButton').disabled = true;
    document.getElementById('finishCallButton').disabled = true;
    }
    }

    function onReceiveChannelStateChange() {
    const readyState = receiveChannel.readyState;
    if (readyState === 'open') {
    document.getElementById('dataChannelReceive').disabled = false;
    } else {
    document.getElementById('dataChannelReceive').disabled = true;
    }
    }