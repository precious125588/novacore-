// ===== ARCHIVE MANAGER (ZArchiver-style) =====
const NCarchive = (() => {
  let currentArchive = null;

  function openPanel() { document.getElementById('archive-panel').classList.remove('hidden'); }
  function closePanel() { document.getElementById('archive-panel').classList.add('hidden'); }

  async function createZip() {
    const content = document.getElementById('archive-content');
    content.innerHTML = '<p style="color:var(--text2);margin-bottom:10px">Select files to compress:</p><button class="btn-secondary full" onclick="NCarchive.pickFilesForZip()">📂 Select Files</button>';
  }

  function pickFilesForZip() {
    const input = document.getElementById('archive-input');
    // Create a new multi-file picker
    const tmp = document.createElement('input');
    tmp.type = 'file';
    tmp.multiple = true;
    tmp.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      await doCreateZip(files);
    };
    tmp.click();
  }

  async function doCreateZip(files) {
    const progress = document.getElementById('archive-progress');
    const fill = document.getElementById('archive-fill');
    const status = document.getElementById('archive-status');
    progress.classList.remove('hidden');
    status.textContent = 'Compressing...';

    try {
      const zip = new JSZip();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const buf = await file.arrayBuffer();
        zip.file(file.name, buf);
        fill.style.width = ((i + 1) / files.length * 60) + '%';
        status.textContent = `Adding: ${file.name}`;
      }
      status.textContent = 'Generating ZIP...';
      fill.style.width = '80%';
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, (meta) => {
        fill.style.width = (80 + meta.percent * 0.2) + '%';
      });
      fill.style.width = '100%';
      status.textContent = 'Done!';

      const name = 'archive_' + Date.now() + '.zip';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; a.click();

      // Save to library
      await NCStorage.put('library', { id: 'arch_' + Date.now(), name, type: 'archive', blobUrl: url, size: blob.size, timestamp: Date.now() });
      NC.ui.toast(`ZIP created: ${name}`, 'success');
    } catch (e) {
      status.textContent = 'Error: ' + e.message;
      NC.ui.toast('ZIP creation failed: ' + e.message, 'error');
    }
  }

  function extractZip() {
    document.getElementById('archive-input').click();
  }

  async function handleFile(input) {
    const file = input.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.zip')) {
      await doExtractZip(file);
    } else {
      NC.ui.toast('Supported: .zip files', 'error');
    }
    input.value = '';
  }

  async function doExtractZip(file) {
    const content = document.getElementById('archive-content');
    const progress = document.getElementById('archive-progress');
    const fill = document.getElementById('archive-fill');
    const status = document.getElementById('archive-status');
    progress.classList.remove('hidden');
    status.textContent = 'Reading archive...';
    fill.style.width = '20%';
    openPanel();

    try {
      const buf = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      currentArchive = zip;
      fill.style.width = '60%';
      status.textContent = 'Archive loaded';

      const files = Object.keys(zip.files).filter(k => !zip.files[k].dir);
      content.innerHTML = `
        <p style="font-size:13px;color:var(--text2);margin-bottom:8px"><strong>${file.name}</strong> — ${files.length} file(s)</p>
        <button class="btn-primary" onclick="NCarchive.extractAll('${encodeURIComponent(file.name)}')">Extract All</button>
        <div style="margin-top:10px;max-height:200px;overflow-y:auto">
          ${files.map(f => `<div class="archive-item"><span>${f}</span><span style="color:var(--text3)">${formatBytes(zip.files[f]._data?.uncompressedSize||0)}</span></div>`).join('')}
        </div>
      `;
      fill.style.width = '100%';
      status.textContent = `Ready — ${files.length} files`;
    } catch (e) {
      status.textContent = 'Error: ' + e.message;
      NC.ui.toast('Could not open archive: ' + e.message, 'error');
    }
  }

  async function extractAll(encodedName) {
    if (!currentArchive) return;
    const progress = document.getElementById('archive-progress');
    const fill = document.getElementById('archive-fill');
    const status = document.getElementById('archive-status');
    progress.classList.remove('hidden');

    const files = Object.keys(currentArchive.files).filter(k => !currentArchive.files[k].dir);
    let done = 0;

    for (const name of files) {
      try {
        const blob = await currentArchive.files[name].async('blob');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name.split('/').pop(); a.click();
        URL.revokeObjectURL(url);
        done++;
        fill.style.width = (done / files.length * 100) + '%';
        status.textContent = `Extracted: ${name.split('/').pop()}`;
        await new Promise(r => setTimeout(r, 100));
      } catch {}
    }
    NC.ui.toast(`Extracted ${done} files`, 'success');
  }

  async function viewArchive() {
    document.getElementById('archive-input').click();
  }

  function formatBytes(b) {
    if (!b) return '0 B';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
    return (b/1048576).toFixed(1) + ' MB';
  }

  return { openPanel, closePanel, createZip, pickFilesForZip, extractZip, handleFile, extractAll, viewArchive };
})();
