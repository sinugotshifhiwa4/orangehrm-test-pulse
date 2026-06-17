/* ══════════════════════════════════════════
   Per-section "Download PNG" export (html2canvas)
   ══════════════════════════════════════════ */
import html2canvas from 'html2canvas';

export const ExportImageModule = {
  safeName(name: string): string {
    return String(name || 'export')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'export';
  },

  downloadDataUrl(dataUrl: string, filename: string): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  replaceCanvases(source: HTMLElement, clone: HTMLElement): void {
    const srcCanvases = source.querySelectorAll('canvas');
    const cloneCanvases = clone.querySelectorAll('canvas');
    cloneCanvases.forEach((canvas, index) => {
      const src = srcCanvases[index];
      if (!src) return;
      const img = document.createElement('img');
      img.src = src.toDataURL('image/png');
      img.style.width = `${src.clientWidth || src.width}px`;
      img.style.height = `${src.clientHeight || src.height}px`;
      img.style.display = 'block';
      img.style.maxWidth = '100%';
      canvas.replaceWith(img);
    });
  },

  async nodeToPng(node: HTMLElement, filename: string): Promise<void> {
    const canvas = await html2canvas(node, {
      backgroundColor: '#0e0f13',
      scale: window.devicePixelRatio > 1 ? 2 : 1,
      useCORS: true,
      logging: false,
      onclone: clonedDoc => {
        clonedDoc.querySelectorAll('.btn-export-image').forEach(btn => btn.remove());
      },
    });

    this.downloadDataUrl(canvas.toDataURL('image/png'), filename);
  },

  async downloadCard(button: HTMLButtonElement): Promise<void> {
    const target = document.getElementById(button.dataset.exportTarget || '');
    if (!target) return;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Exporting...';
    try {
      await this.nodeToPng(target, button.dataset.exportFilename || 'dashboard-export');
    } catch (e) {
      console.error('Export failed', e, target);
      alert('Could not export this section as an image.');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  },

  ensureId(node: HTMLElement, fallback: string): string {
    if (!node.id) node.id = fallback;
    return node.id;
  },

  attachButton(card: HTMLElement, filename: string, label: string): void {
    if (card.dataset.exportEnhanced === 'true') return;
    const header = card.querySelector<HTMLElement>('.section-hd, .table-toolbar, .failing-card-hd');
    if (!header) return;
    const targetId = this.ensureId(card, `export-${filename}`);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-export-image';
    btn.textContent = 'Download PNG';
    btn.dataset.exportTarget = targetId;
    btn.dataset.exportFilename = filename;
    btn.setAttribute('aria-label', `Download ${label} as image`);
    btn.addEventListener('click', () => this.downloadCard(btn));

    let actions = header.querySelector<HTMLElement>('.section-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'section-actions';
      header.appendChild(actions);
    }
    actions.appendChild(btn);
    card.dataset.exportEnhanced = 'true';
  },

  enhance(): void {
    // PNG export is for visual/chart cards only. Tables (.table-card — Recent Runs,
    // Run History) and text lists (.failing-card — Top Failing Tests / Modules,
    // Failure Categories) are better served by the CSV/Excel data export, so they
    // are intentionally excluded.
    document.querySelectorAll<HTMLElement>('.chart-card, .chart-card-full, .breakdown-card').forEach((card, index) => {
      const title = card.querySelector('.section-title')?.textContent?.trim() || `section-${index + 1}`;
      const filename = this.safeName(title);
      this.attachButton(card, filename, title);
    });
  },
};
