function limitValue(id){return Number($(id)?.value||5)}
function renderRowsWithTotal(tableId,headers,rows,limit,totalField='Material Description'){
 const t=$(tableId),h=t.querySelector('thead'),b=t.querySelector('tbody');h.innerHTML='';b.innerHTML='';
 const hr=document.createElement('tr');headers.forEach(x=>{let th=document.createElement('th');th.textContent=x;hr.appendChild(th)});h.appendChild(hr);
 const total=rows.find(r=>r[totalField]==='Grand Total');const body=rows.filter(r=>r!==total).slice(0,limit);
 [...body,...(total?[total]:[])].forEach(r=>{let tr=document.createElement('tr');if(r===total)tr.className='total';headers.forEach(x=>{let td=document.createElement('td');td.textContent=r[x]??'';tr.appendChild(td)});b.appendChild(tr)});
}
function renderDynamicSummary(containerId,data){const c=$(containerId);if(!c)return;c.innerHTML='';Object.entries(data).forEach(([name,value])=>{let d=document.createElement('div');d.className='metric';d.innerHTML=`<span>${name}</span><strong>${Number(value||0).toLocaleString('en-IN')}</strong>`;c.appendChild(d)})}
