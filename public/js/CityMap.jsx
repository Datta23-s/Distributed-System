

function CityMap({ drivers = [], activeRides = [], p2pAlerts = [], onMapClick, selectedPickup, selectedDropoff }) {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear Canvas
      ctx.fillStyle = '#f0f9ff';
      ctx.fillRect(0, 0, width, height);

      // Draw Grid / Streets
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1;
      const step = width / 10;
      for (let i = 0; i <= width; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }

      // Draw Zone Labels
      ctx.fillStyle = 'rgba(2, 132, 199, 0.45)';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('ZONE NORTH (Uptown)', 15, 25);
      ctx.fillText('ZONE SOUTH (Harbour)', 15, height - 15);
      ctx.fillText('ZONE EAST (Tech Park)', width - 170, 25);
      ctx.fillText('ZONE WEST (Airport)', width - 150, height - 15);
      ctx.fillText('CENTRAL (Downtown)', width / 2 - 60, height / 2);

      // Draw P2P Hazard Markers (Gossip Alerts)
      p2pAlerts.forEach((alert) => {
        const hx = (alert.location[0] / 100) * width;
        const hy = (alert.location[1] / 100) * height;

        // Pulsing hazard circle
        ctx.beginPath();
        ctx.arc(hx, hy, 18, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(217, 119, 6, 0.2)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(hx, hy, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#d97706';
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️', hx, hy + 3);

        ctx.fillStyle = '#b45309';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(alert.hazardType, hx, hy - 14);
      });

      // Draw Active Ride Routes
      activeRides.forEach((ride) => {
        if (ride.status === 'COMPLETED') return;
        const px = (ride.pickup[0] / 100) * width;
        const py = (ride.pickup[1] / 100) * height;
        const dx = (ride.dropoff[0] / 100) * width;
        const dy = (ride.dropoff[1] / 100) * height;

        // Dashed path from pickup to dropoff
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.moveTo(px, py);
        ctx.lineTo(dx, dy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Pickup Marker (Green Pin)
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#059669';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('P', px, py + 3);

        // Dropoff Marker (Gold Flag)
        ctx.beginPath();
        ctx.arc(dx, dy, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#d97706';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('D', dx, dy + 3);
      });

      // Draw User Selection Pins
      if (selectedPickup) {
        const sx = (selectedPickup[0] / 100) * width;
        const sy = (selectedPickup[1] / 100) * height;
        ctx.beginPath();
        ctx.arc(sx, sy, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#059669';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (selectedDropoff) {
        const ex = (selectedDropoff[0] / 100) * width;
        const ey = (selectedDropoff[1] / 100) * height;
        ctx.beginPath();
        ctx.arc(ex, ey, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#d97706';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw Driver Nodes (Cars)
      drivers.forEach((drv) => {
        const cx = (drv.x / 100) * width;
        const cy = (drv.y / 100) * height;
        const isCrashed = drv.status === 'CRASHED';
        const isBusy = ['ASSIGNED', 'PICKING_UP', 'ON_TRIP'].includes(drv.status);

        // Vehicle Glow Ring
        ctx.beginPath();
        ctx.arc(cx, cy, isCrashed ? 16 : 14, 0, Math.PI * 2);
        ctx.fillStyle = isCrashed ? 'rgba(225, 29, 72, 0.2)' : (isBusy ? 'rgba(2, 132, 199, 0.2)' : 'rgba(5, 150, 105, 0.2)');
        ctx.fill();

        // Vehicle Body
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fillStyle = isCrashed ? '#e11d48' : (isBusy ? '#0284c7' : '#059669');
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Vehicle Label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(drv.driverId.replace('driver-', 'D'), cx, cy + 3.5);

        // Driver Tag Banner
        ctx.fillStyle = isCrashed ? '#be123c' : '#1e293b';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`${drv.driverId} ${isCrashed ? '[DEAD]' : ''}`, cx, cy - 14);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [drivers, activeRides, p2pAlerts, selectedPickup, selectedDropoff]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !onMapClick) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;
    onMapClick([Math.round(clickX), Math.round(clickY)]);
  };

  return (
    <div className="canvas-wrapper">
      <canvas
        id="city-canvas"
        ref={canvasRef}
        width={700}
        height={700}
        onClick={handleCanvasClick}
      />
      <div className="canvas-overlay-tip">
        📍 <strong>Click Map</strong> to set Pickup (Green) or Dropoff (Gold)
      </div>
    </div>
  );
}

window.CityMap = CityMap;
