$('buildCore').onclick = buildCore;

function parseIssueQty(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let text = value == null ? '' : String(value).replace(/\u00A0/g, ' ').trim();
  if (!text || text === '-' || text === '--') return 0;
  let negative = false;
  if (text.startsWith('(') && text.endsWith(')')) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.endsWith('-')) {
    negative = true;
    text = text.slice(0, -1);
  }
  text = text.replace(/,/g, '').replace(/\s/g, '').replace(/[₹$€£]/g, '').replace(/[^0-9.+-]/g, '');
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return 1;
  return negative ? -Math.abs(parsed) : parsed;
}

function normalizeSto(value) {
  return value == null ? '' : String(value).replace(/\u00A0/g, ' ').trim();
}

function buildCore() {
  const grouped = new Map();
  plan.forEach(row => {
    const sto = normalizeSto(row['STO Number']);
    if (!sto) return;
    if (!grouped.has(sto)) grouped.set(sto, []);
    grouped.get(sto).push(row);
  });

  const blocked = new Set(bsto.map(normalizeSto).filter(Boolean));
  const pendingRows = [];

  for (const [sto, rows] of grouped.entries()) {
    const anyIssued = rows.some(row => parseIssueQty(row['Issue Qty']) !== 0);
    if (!anyIssued && !blocked.has(sto)) pendingRows.push(...rows);
  }

  const manualSet = new Set(mpending.map(normalizeSto).filter(Boolean));
  const unknown = [...new Set(pendingRows.map(row => normalizeSto(row['STO Number'])).filter(Boolean))]
    .filter(sto => !manualSet.has(sto));

  if (unknown.length) {
    unknownModal(unknown, pendingRows);
    return;
  }
  continueCore(pendingRows);
}

function unknownModal(unknown, pendingRows) {
  $('mTitle').textContent = 'Pending / Block Decision';
  $('mBody').innerHTML = '';
  unknown.forEach(sto => {
    const row = document.createElement('div');
    row.className = 'mrow';
    const label = document.createElement('label');
    label.textContent = sto;
    const select = document.createElement('select');
    select.dataset.sto = sto;
    ['Pending', 'Block'].forEach(text => {
      const option = document.createElement('option');
      option.value = text;
      option.textContent = text;
      select.appendChild(option);
    });
    row.append(label, select);
    $('mBody').appendChild(row);
  });

  $('mSave').onclick = () => {
    document.querySelectorAll('#mBody select').forEach(select => {
      const sto = normalizeSto(select.dataset.sto);
      if (select.value === 'Block') {
        if (!bsto.map(normalizeSto).includes(sto)) bsto.push(sto);
      } else if (!mpending.map(normalizeSto).includes(sto)) {
        mpending.push(sto);
      }
    });
    closeM();
    drawBsto();
    save();
    const blocked = new Set(bsto.map(normalizeSto).filter(Boolean));
    continueCore(pendingRows.filter(row => !blocked.has(normalizeSto(row['STO Number']))));
  };
  openM();
}

function continueCore(pendingRows) {
  if (raipur.length) raipurModal(pendingRows);
  else finalCore(pendingRows, []);
}

function raipurModal(pendingRows) {
  $('mTitle').textContent = 'Raipur Setup';
  $('mBody').innerHTML = '<div class="mrow"><label>Raipur SPlt</label><input id="rsplt" placeholder="Type SPlt"></div><div class="mrow"><label>Raipur Dispatch?</label><select id="rdisp"><option>Yes</option><option>No</option></select></div>';
  $('mSave').onclick = () => {
    const splt = N($('rsplt').value);
    const dispatch = $('rdisp').value;
    let extra = [];
    if (dispatch === 'No') {
      extra = raipur.map(row => ({SPlt:splt,Plant:row.Plant,'Plant Name':'',Location:'Raipur','Material No.':row['Material No.'],Description:row.Description,'STO Qty':Q(row.Qty),'STO Number':''}));
    }
    closeM();
    finalCore(pendingRows, extra);
  };
  openM();
}

function finalCore(pendingRows, extraRows) {
  core = pendingRows.map(row => ({SPlt:row.SPlt,Plant:row.Plant,'Plant Name':row['Plant Name'],Location:row.Location,'Material No.':row['Material No.'],Description:row.Description,'STO Qty':Q(row['STO Qty']),'STO Number':row['STO Number']})).concat(extraRows);
  drawFull('coreTable', CC, core, 500);
  $('coreInfo').textContent = `${core.length} rows • ${new Set(core.map(row => normalizeSto(row['STO Number'])).filter(Boolean)).size} STO`;
  refresh();
  toast('Core Pending ready');
}

$('sendPlan').onclick = () => {
  if (!core.length) return toast('Pehle Core Pending build karein');
  const splts = [...new Set(core.map(row => N(row.SPlt)).filter(Boolean))];
  $('mTitle').textContent = 'Send Data to Plan';
  $('mBody').innerHTML = '';
  splts.forEach(splt => {
    const row = document.createElement('div');
    row.className = 'mrow';
    row.innerHTML = `<label>${splt}</label><input data-splt="${splt}" placeholder="Plan Name or Ignore">`;
    $('mBody').appendChild(row);
  });
  $('mSave').onclick = () => {
    const names = new Map();
    document.querySelectorAll('#mBody input').forEach(input => names.set(input.dataset.splt, N(input.value)));
    const aggregated = new Map();
    core.forEach(row => {
      const planName = names.get(N(row.SPlt));
      if (!planName || planName.toLowerCase() === 'ignore') return;
      const key = `${planName}||${N(row['Material No.'])}||${N(row.Description)}`;
      if (!aggregated.has(key)) aggregated.set(key, {'Plan Name':planName,'Material No.':N(row['Material No.']),Description:N(row.Description),Qty:0});
      aggregated.get(key).Qty += Q(row['STO Qty']);
    });
    planning = [...aggregated.values()];
    closeM();
    drawPlanning();
    refresh();
    save();
    toast(`${planning.length} planning records`);
  };
  openM();
};
