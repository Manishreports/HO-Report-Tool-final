/*
  CORE PENDING ENGINE

  Rule:
  STO tabhi Pending hoga jab uski har row me Issue Qty zero ya blank ho.
  Kisi ek row me bhi non-zero Issue Qty hui to poora STO remove hoga.
*/

$('buildCore').onclick = buildCore;

function parseIssueQty(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  let text = value === null || value === undefined
    ? ''
    : String(value);

  text = text
    .replace(/\u00A0/g, ' ')
    .trim();

  if (
    text === '' ||
    text === '-' ||
    text === '--'
  ) {
    return 0;
  }

  let negative = false;

  if (text.startsWith('(') && text.endsWith(')')) {
    negative = true;
    text = text.slice(1, -1);
  }

  if (text.endsWith('-')) {
    negative = true;
    text = text.slice(0, -1);
  }

  text = text
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .replace(/[₹$€£]/g, '')
    .replace(/[^0-9.+-]/g, '');

  const parsed = Number(text);

  /*
    Non-empty value samajh na aaye to safety ke liye
    usko issued maana jayega, pending nahi.
  */
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return negative ? -Math.abs(parsed) : parsed;
}

function normalizeSto(value) {
  return value === null || value === undefined
    ? ''
    : String(value)
        .replace(/\u00A0/g, ' ')
        .trim();
}

function isPendingSto(rows) {
  return (
    rows.length > 0 &&
    rows.every(row => {
      return parseIssueQty(row['Issue Qty']) === 0;
    })
  );
}

function buildCore() {
  const groupedBySto = new Map();

  plan.forEach(row => {
    const stoNumber = normalizeSto(row['STO Number']);

    if (!stoNumber) {
      return;
    }

    if (!groupedBySto.has(stoNumber)) {
      groupedBySto.set(stoNumber, []);
    }

    groupedBySto.get(stoNumber).push(row);
  });

  const blockedStoSet = new Set(
    bsto
      .map(normalizeSto)
      .filter(Boolean)
  );

  const pendingRows = [];

  for (const [stoNumber, rows] of groupedBySto.entries()) {
    /*
      Kisi ek material me Issue Qty non-zero hui,
      to isPendingSto false hoga aur poora STO skip hoga.
    */
    if (
      isPendingSto(rows) &&
      !blockedStoSet.has(stoNumber)
    ) {
      pendingRows.push(...rows);
    }
  }

  const manualPendingSet = new Set(
    mpending
      .map(normalizeSto)
      .filter(Boolean)
  );

  const unknownSto = [
    ...new Set(
      pendingRows
        .map(row => normalizeSto(row['STO Number']))
        .filter(Boolean)
    )
  ].filter(stoNumber => {
    return !manualPendingSet.has(stoNumber);
  });

  if (unknownSto.length) {
    unknownModal(unknownSto, pendingRows);
    return;
  }

  continueCore(pendingRows);
}

function unknownModal(unknownSto, pendingRows) {
  $('mTitle').textContent = 'Pending / Block Decision';
  $('mBody').innerHTML = '';

  unknownSto.forEach(stoNumber => {
    const row = document.createElement('div');
    row.className = 'mrow';

    const label = document.createElement('label');
    label.textContent = stoNumber;

    const select = document.createElement('select');
    select.dataset.sto = stoNumber;

    ['Pending', 'Block'].forEach(optionText => {
      const option = document.createElement('option');
      option.value = optionText;
      option.textContent = optionText;
      select.appendChild(option);
    });

    row.append(label, select);
    $('mBody').appendChild(row);
  });

  $('mSave').onclick = () => {
    document
      .querySelectorAll('#mBody select')
      .forEach(select => {
        const stoNumber = normalizeSto(
          select.dataset.sto
        );

        if (select.value === 'Block') {
          const alreadyBlocked = bsto
            .map(normalizeSto)
            .includes(stoNumber);

          if (!alreadyBlocked) {
            bsto.push(stoNumber);
          }
        } else {
          const alreadyPending = mpending
            .map(normalizeSto)
            .includes(stoNumber);

          if (!alreadyPending) {
            mpending.push(stoNumber);
          }
        }
      });

    closeM();
    drawBsto();
    save();

    const blockedStoSet = new Set(
      bsto
        .map(normalizeSto)
        .filter(Boolean)
    );

    continueCore(
      pendingRows.filter(row => {
        return !blockedStoSet.has(
          normalizeSto(row['STO Number'])
        );
      })
    );
  };

  openM();
}

function continueCore(pendingRows) {
  if (raipur.length) {
    raipurModal(pendingRows);
  } else {
    finalCore(pendingRows, []);
  }
}

function raipurModal(pendingRows) {
  $('mTitle').textContent = 'Raipur Setup';

  $('mBody').innerHTML = `
    <div class="mrow">
      <label>Raipur SPlt</label>
      <input id="rsplt" placeholder="Type SPlt">
    </div>

    <div class="mrow">
      <label>Raipur Dispatch?</label>
      <select id="rdisp">
        <option>Yes</option>
        <option>No</option>
      </select>
    </div>
  `;

  $('mSave').onclick = () => {
    const splt = N($('rsplt').value);
    const dispatch = $('rdisp').value;

    let extraRows = [];

    if (dispatch === 'No') {
      extraRows = raipur.map(row => ({
        SPlt: splt,
        Plant: row.Plant,
        'Plant Name': '',
        Location: 'Raipur',
        'Material No.': row['Material No.'],
        Description: row.Description,
        'STO Qty': Q(row.Qty),
        'STO Number': ''
      }));
    }

    closeM();
    finalCore(pendingRows, extraRows);
  };

  openM();
}

function finalCore(pendingRows, extraRows) {
  core = pendingRows
    .map(row => ({
      SPlt: row.SPlt,
      Plant: row.Plant,
      'Plant Name': row['Plant Name'],
      Location: row.Location,
      'Material No.': row['Material No.'],
      Description: row.Description,
      'STO Qty': Q(row['STO Qty']),
      'STO Number': row['STO Number']
    }))
    .concat(extraRows);

  drawFull('coreTable', CC, core, 500);

  const stoCount = new Set(
    core
      .map(row => normalizeSto(row['STO Number']))
      .filter(Boolean)
  ).size;

  $('coreInfo').textContent =
    `${core.length} rows • ${stoCount} STO`;

  refresh();
  toast('Core Pending ready');
}

$('sendPlan').onclick = () => {
  if (!core.length) {
    toast('Pehle Core Pending build karein');
    return;
  }

  const spltList = [
    ...new Set(
      core
        .map(row => N(row.SPlt))
        .filter(Boolean)
    )
  ];

  $('mTitle').textContent = 'Send Data to Plan';
  $('mBody').innerHTML = '';

  spltList.forEach(splt => {
    const row = document.createElement('div');
    row.className = 'mrow';

    const label = document.createElement('label');
    label.textContent = splt;

    const input = document.createElement('input');
    input.dataset.splt = splt;
    input.placeholder = 'Plan Name or Ignore';

    row.append(label, input);
    $('mBody').appendChild(row);
  });

  $('mSave').onclick = () => {
    const planNameBySplt = new Map();

    document
      .querySelectorAll('#mBody input')
      .forEach(input => {
        planNameBySplt.set(
          input.dataset.splt,
          N(input.value)
        );
      });

    const aggregated = new Map();

    core.forEach(row => {
      const planName =
        planNameBySplt.get(N(row.SPlt));

      if (
        !planName ||
        planName.toLowerCase() === 'ignore'
      ) {
        return;
      }

      const key =
        `${planName}||` +
        `${N(row['Material No.'])}||` +
        `${N(row.Description)}`;

      if (!aggregated.has(key)) {
        aggregated.set(key, {
          'Plan Name': planName,
          'Material No.': N(row['Material No.']),
          Description: N(row.Description),
          Qty: 0
        });
      }

      aggregated.get(key).Qty +=
        Q(row['STO Qty']);
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
