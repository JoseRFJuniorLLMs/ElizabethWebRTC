document.addEventListener('DOMContentLoaded', (event) => {
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
  
    // Set canvas to full window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  
    let drawing = false;
  
    // Set initial stroke style
    ctx.strokeStyle = 'slateBlue';
    ctx.lineWidth = 1;
  
    canvas.addEventListener('mousedown', (e) => {
      drawing = true;
      ctx.beginPath();
      ctx.moveTo(e.clientX, e.clientY);
    });
  
    canvas.addEventListener('mousemove', (e) => {
      if (drawing) {
        ctx.lineTo(e.clientX, e.clientY);
        ctx.stroke();
      }
    });
  
    canvas.addEventListener('mouseup', () => {
      drawing = false;
    });
  
    canvas.addEventListener('mouseleave', () => {
      drawing = false;
    });
  
    document.addEventListener('keydown', (e) => {
      // Change color with character keys
      if (e.key.match(/[a-z]/i)) {
        ctx.strokeStyle = 'turquoise';
        ctx.lineWidth = Math.random() * 5;
      }
    });
  
    document.addEventListener('keyup', (e) => {
      // Change color with any key release
      ctx.strokeStyle = `hsl(${Math.random() * 125 + 20}, 100%, ${Math.random() * 20 + 80}%)`;
      ctx.lineWidth = Math.random();
    });
  });
  