// ⚡ Replace with your Supabase keys
const SUPABASE_URL = "https://khuywlmmwstjxtjnwtfx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtodXl3bG1td3N0anh0am53dGZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MzYzNjMsImV4cCI6MjA3MTUxMjM2M30.mqsRrJkF4qEwDvttkz5pIi_dNlIpUCuwucq93yA3CDY";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const video = document.getElementById('video');
const status = document.getElementById('status');
const attendanceList = document.getElementById('attendance');
let labeledDescriptors = []; // store known faces

// Load face-api models
Promise.all([
  faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
  faceapi.nets.ssdMobilenetv1.loadFromUri('./models')
]).then(() => {
  console.log("✅ Models loaded");
  startVideo();
});

function startVideo() {
  navigator.mediaDevices.getUserMedia({ video: {} })
    .then(stream => video.srcObject = stream)
    .catch(err => console.error(err));
  status.innerText = "Upload an image to register.";
}

// Register uploaded face
document.getElementById('imageUpload').addEventListener('change', async (e) => {
  const img = await faceapi.bufferToImage(e.target.files[0]);
  const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
  if (!detection) {
    alert("No face detected, try another image.");
    return;
  }
  const label = prompt("Enter your name:");
  if (!label) return;
  labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(label, [detection.descriptor]));
  status.innerText = `${label} registered. Now scanning...`;
});

// Save attendance to Supabase
async function markAttendance(name) {
  const { data, error } = await supabaseClient
    .from("attendance")
    .insert([{ name }]);
  if (error) {
    console.error("Supabase insert error:", error);
  } else {
    console.log("✅ Attendance saved:", data);
  }
}

// Recognize face from webcam
video.addEventListener('play', () => {
  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.append(canvas);
  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    const detections = await faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors();
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

    if (labeledDescriptors.length > 0) {
      const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
      const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));
      results.forEach((result, i) => {
        const box = resizedDetections[i].detection.box;
        const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString() });
        drawBox.draw(canvas);

        // Mark attendance if recognized
        if (!document.getElementById(result.label)) {
          let li = document.createElement("li");
          li.id = result.label;
          li.innerText = `${result.label} - Present`;
          attendanceList.appendChild(li);

          // Save to Supabase
          if (result.label !== "unknown") {
            markAttendance(result.label);
          }
        }
      });
    }
  }, 2000);
});
