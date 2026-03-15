/**
 * Horizon View — Horizon-Lattice (S) Browser
 * SEG(|) to cut / CON(⋈) to join — Lens management and horizon composition.
 *
 * Create, compose, and inspect analytical lenses that mediate
 * what is visible, from where, under what constraints.
 */

import { LensType, OPERATORS } from '../models/operators.js';
import { getAllLenses, getLens, getLensHistory } from '../models/horizon_lattice.js';
import {
  createTemporalLens, createGeographicLens, createCategoricalLens,
  createMethodologicalLens, createObserverLens,
  composeHorizon, getAllHorizons
} from '../horizon/service.js';
import { html, renderModal, toast } from './components.js';

const LENS_TYPE_META = {
  [LensType.TEMPORAL]:       { glyph: '|', label: 'Temporal', fields: ['dateStart:Date Start', 'dateEnd:Date End', 'cycle:Cycle (optional)'] },
  [LensType.GEOGRAPHIC]:     { glyph: '|', label: 'Geographic', fields: ['grain:Grain (county/state/national)', 'regions:Regions (comma-separated, optional)'] },
  [LensType.CATEGORICAL]:    { glyph: '|', label: 'Categorical', fields: ['include:Include (comma-separated)', 'exclude:Exclude (comma-separated, optional)'] },
  [LensType.METHODOLOGICAL]: { glyph: '|', label: 'Methodological', fields: ['method:Method', 'description:Description (optional)'] },
  [LensType.OBSERVER]:       { glyph: '|', label: 'Observer', fields: ['analyst:Analyst', 'affiliation:Affiliation (optional)', 'mandate:Mandate (optional)'] }
};

export function renderHorizonView(container) {
  container.innerHTML = '';

  const view = html`
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
          <i class="ph ph-binoculars" style="color: var(--accent); font-size: 1.3rem;"></i>
          Perspectives
        </h2>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary" id="btn-new-lens"><i class="ph ph-plus"></i> New Filter</button>
          <button class="btn" id="btn-compose-horizon"><i class="ph ph-intersect"></i> Compose Perspective</button>
        </div>
      </div>
    </div>
  `;

  // Lenses section
  const lenses = getAllLenses();
  const horizons = getAllHorizons();

  if (lenses.length === 0 && horizons.length === 0) {
    view.appendChild(html`
      <div class="empty-state">
        <div class="empty-icon"><i class="ph ph-binoculars" style="font-size: 3rem;"></i></div>
        <p>No filters or perspectives yet.<br>
        Create a filter to scope your data,<br>
        then compose them into a perspective.</p>
      </div>
    `);
  } else {
    // Horizons
    if (horizons.length > 0) {
      view.appendChild(html`<h3 style="font-size: 1rem; margin-bottom: 12px; color: var(--text-secondary);"><i class="ph ph-intersect"></i> Composed Perspectives</h3>`);
      for (const horizon of horizons) {
        view.appendChild(_renderHorizonCard(horizon));
      }
    }

    // Lenses
    if (lenses.length > 0) {
      view.appendChild(html`<h3 style="font-size: 1rem; margin: 20px 0 12px; color: var(--text-secondary);"><i class="ph ph-funnel"></i> Individual Filters</h3>`);
      for (const lens of lenses) {
        if (!lens.parent_id) {
          view.appendChild(_renderLensCard(lens));
        }
      }
    }
  }

  container.appendChild(view);

  // Event listeners
  document.getElementById('btn-new-lens').addEventListener('click', () => _showNewLensModal(container));
  document.getElementById('btn-compose-horizon').addEventListener('click', () => _showComposeModal(container));
}

function _renderLensCard(lens) {
  const params = JSON.parse(lens.parameters_json);
  const meta = LENS_TYPE_META[lens.lens_type] || { label: lens.lens_type, glyph: '|' };

  const card = html`
    <div class="card" style="margin-bottom: 10px; cursor: pointer;">
      <div class="card-header">
        <span class="op-glyph structure">${meta.glyph}</span>
        <div class="card-title">${lens.name}</div>
        <span style="font-size: 0.75rem; color: var(--text-muted);">${meta.label}</span>
      </div>
      <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 6px;">
        ${Object.entries(params).filter(([,v]) => v != null).map(([k, v]) =>
          `<span style="margin-right: 12px;"><strong>${k}:</strong> ${v}</span>`
        ).join('')}
      </div>
      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">
        ${lens.created_at}${lens.created_by ? ` by ${lens.created_by}` : ''}
      </div>
    </div>
  `;

  card.addEventListener('click', () => _showLensDetail(lens));
  return card;
}

function _renderHorizonCard(horizon) {
  const lensIds = JSON.parse(horizon.lens_ids_json);

  const card = html`
    <div class="card" style="margin-bottom: 10px;">
      <div class="card-header">
        <span class="op-glyph structure">⋈</span>
        <div class="card-title">${horizon.name}</div>
        <span style="font-size: 0.75rem; color: var(--text-muted);">${lensIds.length} filters</span>
      </div>
      <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap;">
        ${lensIds.map(id => {
          const l = getLens(id);
          return l ? `<span style="background: var(--bg-surface); padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border-subtle);">| ${l.name}</span>` : '';
        }).join('')}
      </div>
      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">
        ${horizon.created_at}
      </div>
    </div>
  `;

  return card;
}

function _showLensDetail(lens) {
  const params = JSON.parse(lens.parameters_json);
  const history = getLensHistory(lens.id);
  const meta = LENS_TYPE_META[lens.lens_type] || { label: lens.lens_type };

  const content = html`<div></div>`;

  // Parameters
  content.appendChild(html`
    <div style="margin-bottom: 16px;">
      <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Type</div>
      <div>${meta.label}</div>
    </div>
  `);

  content.appendChild(html`
    <div style="margin-bottom: 16px;">
      <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Parameters</div>
      <pre class="notation" style="font-size: 0.8rem;">${JSON.stringify(params, null, 2)}</pre>
    </div>
  `);

  // Version history
  if (history.length > 1) {
    const historyEl = html`
      <div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Version History (${history.length} versions)</div>
      </div>
    `;
    for (const version of history) {
      historyEl.appendChild(html`
        <div style="font-size: 0.85rem; padding: 4px 0; border-left: 2px solid var(--accent); padding-left: 12px; margin-bottom: 4px;">
          ${version.created_at} — ${version.change_reason || 'Initial'}
        </div>
      `);
    }
    content.appendChild(historyEl);
  }

  renderModal(`| ${lens.name}`, content, [{ label: 'Close' }]);
}

function _showNewLensModal(parentContainer) {
  const content = html`<div></div>`;

  // Lens type selector
  const typeSelect = document.createElement('select');
  typeSelect.className = 'form-select';
  typeSelect.style.marginBottom = '12px';
  for (const [type, meta] of Object.entries(LENS_TYPE_META)) {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = `${meta.glyph} ${meta.label}`;
    typeSelect.appendChild(opt);
  }

  content.appendChild(html`<div style="margin-bottom: 8px;"><label style="font-size: 0.85rem;">Filter Type</label></div>`);
  content.appendChild(typeSelect);

  // Name field
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Filter name';
  nameInput.className = 'form-input';
  nameInput.style.cssText = 'width: 100%; margin-bottom: 12px; padding: 8px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-subtle); border-radius: 4px;';
  content.appendChild(html`<div style="margin-bottom: 4px;"><label style="font-size: 0.85rem;">Name</label></div>`);
  content.appendChild(nameInput);

  // Dynamic fields container
  const fieldsContainer = document.createElement('div');
  fieldsContainer.id = 'lens-fields';
  content.appendChild(fieldsContainer);

  function _renderFields(type) {
    fieldsContainer.innerHTML = '';
    const meta = LENS_TYPE_META[type];
    if (!meta) return;

    for (const fieldSpec of meta.fields) {
      const [fieldKey, fieldLabel] = fieldSpec.split(':');
      const input = document.createElement('input');
      input.type = fieldKey.toLowerCase().includes('date') ? 'date' : 'text';
      input.placeholder = fieldLabel;
      input.dataset.field = fieldKey;
      input.className = 'form-input';
      input.style.cssText = 'width: 100%; margin-bottom: 8px; padding: 8px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-subtle); border-radius: 4px;';
      fieldsContainer.appendChild(html`<div style="margin-bottom: 4px;"><label style="font-size: 0.85rem;">${fieldLabel}</label></div>`);
      fieldsContainer.appendChild(input);
    }
  }

  _renderFields(typeSelect.value);
  typeSelect.addEventListener('change', () => _renderFields(typeSelect.value));

  // Created by
  const createdByInput = document.createElement('input');
  createdByInput.type = 'text';
  createdByInput.placeholder = 'Analyst name (optional)';
  createdByInput.className = 'form-input';
  createdByInput.style.cssText = 'width: 100%; margin-bottom: 12px; padding: 8px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-subtle); border-radius: 4px;';
  content.appendChild(html`<div style="margin-bottom: 4px; margin-top: 8px;"><label style="font-size: 0.85rem;">Created By (optional)</label></div>`);
  content.appendChild(createdByInput);

  renderModal('Create Filter', content, [
    {
      label: 'Create',
      primary: true,
      onClick: () => {
        const name = nameInput.value.trim();
        if (!name) { toast('Name is required', 'error'); return; }

        const type = typeSelect.value;
        const fields = {};
        fieldsContainer.querySelectorAll('input[data-field]').forEach(input => {
          const val = input.value.trim();
          if (val) fields[input.dataset.field] = val;
        });
        const createdBy = createdByInput.value.trim() || null;

        try {
          const creators = {
            [LensType.TEMPORAL]: () => createTemporalLens({ name, dateStart: fields.dateStart, dateEnd: fields.dateEnd, cycle: fields.cycle, createdBy }),
            [LensType.GEOGRAPHIC]: () => createGeographicLens({ name, grain: fields.grain, regions: fields.regions, createdBy }),
            [LensType.CATEGORICAL]: () => createCategoricalLens({ name, include: fields.include, exclude: fields.exclude, createdBy }),
            [LensType.METHODOLOGICAL]: () => createMethodologicalLens({ name, method: fields.method, description: fields.description, createdBy }),
            [LensType.OBSERVER]: () => createObserverLens({ name, analyst: fields.analyst, affiliation: fields.affiliation, mandate: fields.mandate, createdBy })
          };

          creators[type]();
          toast(`Filter "${name}" created`, 'success');
          renderHorizonView(parentContainer);
        } catch (err) {
          toast(err.message, 'error');
        }
      }
    },
    { label: 'Cancel' }
  ]);
}

function _showComposeModal(parentContainer) {
  const lenses = getAllLenses().filter(l => !l.parent_id);

  if (lenses.length < 1) {
    toast('Create at least one filter first', 'error');
    return;
  }

  const content = html`<div></div>`;

  // Name
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Perspective name';
  nameInput.className = 'form-input';
  nameInput.style.cssText = 'width: 100%; margin-bottom: 12px; padding: 8px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-subtle); border-radius: 4px;';
  content.appendChild(html`<div style="margin-bottom: 4px;"><label style="font-size: 0.85rem;">Perspective Name</label></div>`);
  content.appendChild(nameInput);

  // Lens checkboxes
  content.appendChild(html`<div style="margin-bottom: 4px;"><label style="font-size: 0.85rem;">Select Filters to Compose</label></div>`);

  const checkboxContainer = document.createElement('div');
  checkboxContainer.style.cssText = 'max-height: 200px; overflow-y: auto; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 8px;';

  for (const lens of lenses) {
    const meta = LENS_TYPE_META[lens.lens_type] || { label: lens.lens_type };
    const label = document.createElement('label');
    label.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 0.85rem; cursor: pointer;';
    label.innerHTML = `<input type="checkbox" value="${lens.id}"> <span style="color: var(--text-muted);">[${meta.label}]</span> ${lens.name}`;
    checkboxContainer.appendChild(label);
  }
  content.appendChild(checkboxContainer);

  renderModal('Compose Perspective', content, [
    {
      label: 'Compose',
      primary: true,
      onClick: () => {
        const name = nameInput.value.trim();
        if (!name) { toast('Name is required', 'error'); return; }

        const selectedIds = [];
        checkboxContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
          selectedIds.push(cb.value);
        });

        if (selectedIds.length === 0) { toast('Select at least one lens', 'error'); return; }

        try {
          composeHorizon({ name, lensIds: selectedIds });
          toast(`Perspective "${name}" composed with ${selectedIds.length} filters`, 'success');
          renderHorizonView(parentContainer);
        } catch (err) {
          toast(err.message, 'error');
        }
      }
    },
    { label: 'Cancel' }
  ]);
}
