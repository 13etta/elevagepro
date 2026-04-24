function drawWeightChart(id, points){
  const c=document.getElementById(id); if(!c || !points.length) return;
  const ctx=c.getContext('2d'), w=c.width=c.offsetWidth*devicePixelRatio, h=c.height=c.offsetHeight*devicePixelRatio;
  ctx.clearRect(0,0,w,h); ctx.lineWidth=2*devicePixelRatio; ctx.strokeStyle='#b88746'; ctx.fillStyle='#f4efe7';
  const vals=points.map(p=>Number(p.weight_kg)); const min=Math.min(...vals)-1, max=Math.max(...vals)+1;
  const x=i=>40*devicePixelRatio+(w-70*devicePixelRatio)*(i/Math.max(1,points.length-1));
  const y=v=>h-30*devicePixelRatio-(h-60*devicePixelRatio)*((v-min)/(max-min||1));
  ctx.beginPath(); points.forEach((p,i)=>{ i?ctx.lineTo(x(i),y(p.weight_kg)):ctx.moveTo(x(i),y(p.weight_kg)); }); ctx.stroke();
  points.forEach((p,i)=>{ctx.beginPath();ctx.arc(x(i),y(p.weight_kg),4*devicePixelRatio,0,Math.PI*2);ctx.fill();});
}
