import React, { useState, useCallback, useContext } from 'react';
import { ref, push, child, set, update } from 'firebase/database';
import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { AssetComponent } from '../types';
import { ToastContext } from '../context/AppContext';
import { fmtIp, compressAndEncodeImage } from '../utils/helpers';

interface AssetCatalogueViewProps {
  assets: AssetComponent[];
  userRole: string;
}

const KNOWN_FIELD_ALIASES: Record<string, keyof AssetComponent> = {
  'assetname': 'componentName',
  'componentname': 'componentName',
  'assetno': 'componentName',
  'toolid': 'componentName',
  'componentno': 'componentName',
  'category': 'category',
  'make': 'make',
  'manufacturer': 'make',
  'brand': 'make',
  'controllerserial': 'controllerSerial',
  'controllerserialno': 'controllerSerial',
  'serialno': 'controllerSerial',
  'ipaddress': 'ipAddress',
  'ipaddr': 'ipAddress',
  'stagelocation': 'stageLocation',
  'stage': 'stageLocation',
  'location': 'stageLocation',
  'loc': 'stageLocation'
};

export function AssetCatalogueView({ assets, userRole }: AssetCatalogueViewProps) {
  const { addToast } = useContext(ToastContext);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('Tools');
  const [newMake, setNewMake] = useState('');
  const [newSerial, setNewSerial] = useState('');
  const [newIp, setNewIp] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [extraFields, setExtraFields] = useState<{ key: string; val: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<AssetComponent>>({});
  const [editExtra, setEditExtra] = useState<{ key: string; val: string }[]>([]);
  const [importing, setImporting] = useState(false);

  const addExtraField = () => setExtraFields(f => [...f, { key: '', val: '' }]);
  const removeExtraField = (i: number) => setExtraFields(f => f.filter((_, idx) => idx !== i));
  const updateExtraField = (i: number, k: 'key' | 'val', v: string) =>
    setExtraFields(f => f.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));

  const registerNewAsset = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newName.trim()) {
        addToast("Asset Name is required.", "error");
        return;
      }
      const assetKey = push(child(ref(db), 'assets')).key;
      if (!assetKey) return;
      const custom: Record<string, string> = {};
      extraFields.filter(f => f.key.trim()).forEach(f => {
        custom[f.key.trim()] = f.val;
      });
      const payload: AssetComponent = {
        id: assetKey,
        componentName: newName.trim(),
        category: newCat,
        make: newMake.trim(),
        controllerSerial: newSerial.trim(),
        ipAddress: newIp.trim() || '0.0.0.0',
        stageLocation: newLoc.trim(),
        statusFlag: 'OK',
        sopQrCode: '',
        ...(Object.keys(custom).length > 0 && { customFields: custom })
      };
      set(ref(db, `assets/${assetKey}`), payload)
        .then(() => {
          addToast("Asset registered successfully.", "success");
          setNewName('');
          setNewMake('');
          setNewSerial('');
          setNewIp('');
          setNewLoc('');
          setExtraFields([]);
        })
        .catch(err => addToast(`Failed: ${err.message}`, "error"));
    },
    [newName, newCat, newMake, newSerial, newIp, newLoc, extraFields, addToast]
  );

  const handleAssetExcelImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImporting(true);
      const reader = new FileReader();
      reader.onload = evt => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
          if (rows.length === 0) {
            addToast("Excel file has no rows.", "error");
            setImporting(false);
            return;
          }
          const existingByName = new Map<string, AssetComponent>();
          assets.forEach(a => existingByName.set(a.componentName.trim().toLowerCase(), a));
          const updates: Record<string, any> = {};
          let createdCount = 0;
          let updatedCount = 0;

          rows.forEach(row => {
            const mapped: Partial<AssetComponent> = {};
            const custom: Record<string, string> = {};
            Object.entries(row).forEach(([colName, rawVal]) => {
              const val = rawVal === undefined || rawVal === null ? '' : String(rawVal).trim();
              const key = colName.trim().toLowerCase().replace(/[\s_.\-]+/g, '');
              const aliasTarget = KNOWN_FIELD_ALIASES[key];
              if (aliasTarget) {
                (mapped as any)[aliasTarget] = val;
              } else if (colName.trim()) {
                custom[colName.trim()] = val;
              }
            });
            const name = (mapped.componentName || '').trim();
            if (!name) return;
            const existing = existingByName.get(name.toLowerCase());
            if (existing) {
              const payload: Record<string, any> = {};
              (['category', 'make', 'controllerSerial', 'ipAddress', 'stageLocation'] as const).forEach(f => {
                if (mapped[f] !== undefined && mapped[f] !== '') payload[f] = mapped[f];
              });
              if (Object.keys(custom).length > 0) payload.customFields = { ...(existing.customFields || {}), ...custom };
              if (Object.keys(payload).length > 0) {
                Object.entries(payload).forEach(([k, v]) => {
                  updates[`/assets/${existing.id}/${k}`] = v;
                });
                updatedCount++;
              }
            } else {
              const assetKey = push(child(ref(db), 'assets')).key;
              if (!assetKey) return;
              const payload: AssetComponent = {
                id: assetKey,
                componentName: name,
                category: mapped.category || 'Tools',
                make: mapped.make || '',
                controllerSerial: mapped.controllerSerial || '',
                ipAddress: mapped.ipAddress || '0.0.0.0',
                stageLocation: mapped.stageLocation || '',
                statusFlag: 'OK',
                sopQrCode: '',
                ...(Object.keys(custom).length > 0 && { customFields: custom })
              };
              updates[`/assets/${assetKey}`] = payload;
              existingByName.set(name.toLowerCase(), payload);
              createdCount++;
            }
          });
          update(ref(db), updates)
            .then(() => addToast(`Import done: ${createdCount} added, ${updatedCount} updated.`, "success"))
            .catch(err => addToast(`Import failed: ${err.message}`, "error"))
            .finally(() => setImporting(false));
        } catch (err: any) {
          addToast(`Could not read file: ${err.message}`, "error");
          setImporting(false);
        } finally {
          e.target.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [assets, addToast]
  );

  const startEdit = (a: AssetComponent) => {
    setEditingId(a.id);
    setEditData({
      componentName: a.componentName,
      category: a.category,
      make: a.make || '',
      controllerSerial: a.controllerSerial || '',
      ipAddress: a.ipAddress,
      stageLocation: a.stageLocation
    });
    setEditExtra(Object.entries(a.customFields || {}).map(([k, v]) => ({ key: k, val: v as string })));
  };

  const saveEdit = async (id: string) => {
    const custom: Record<string, string> = {};
    editExtra.filter(f => f.key.trim()).forEach(f => {
      custom[f.key.trim()] = f.val;
    });
    await update(ref(db, `assets/${id}`), {
      ...editData,
      customFields: Object.keys(custom).length > 0 ? custom : null
    })
      .then(() => {
        addToast("Asset updated.", "success");
        setEditingId(null);
      })
      .catch(err => addToast(`Failed: ${err.message}`, "error"));
  };

  const iCell = (field: keyof typeof editData, placeholder = '') => (
    <input
      type="text"
      value={(editData[field] as string) || ''}
      onChange={e => setEditData({ ...editData, [field]: e.target.value })}
      placeholder={placeholder}
      className="w-full p-1.5 border border-indigo-400 rounded-lg text-slate-900 outline-none text-xs font-semibold min-w-[80px]"
    />
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* ── Add / Import Asset Section ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Register Line Equipment</h4>
            <p className="text-[11px] text-slate-400">Ashok Leyland Asset Tracking System</p>
          </div>
          <label
            className={`cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] tracking-wide transition-all shadow-sm flex items-center gap-1.5 ${
              importing ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            {importing ? '⏳ Importing...' : '📥 Import Excel / CSV'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              disabled={importing}
              onChange={handleAssetExcelImport}
            />
          </label>
        </div>
        <form onSubmit={registerNewAsset} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Asset No. / Tag *</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                maxLength={30}
                placeholder="e.g. LT1111"
                className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
                className="w-full p-2.5 bg-white rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none"
              >
                <option>Tools</option>
                <option>TVs &amp; Scanners</option>
                <option>UPS</option>
                <option>Panels</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Make / Brand</label>
              <input
                type="text"
                value={newMake}
                onChange={e => setNewMake(e.target.value)}
                maxLength={50}
                placeholder="e.g. Atlas Copco, Tohnichi"
                className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Controller Serial</label>
              <input
                type="text"
                value={newSerial}
                onChange={e => setNewSerial(e.target.value)}
                maxLength={30}
                placeholder="e.g. A06814"
                className="w-full p-2.5 font-mono rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">IP Address</label>
              <input
                type="text"
                value={newIp}
                onChange={e => setNewIp(e.target.value)}
                maxLength={15}
                placeholder="192.168.1.50"
                className="w-full p-2.5 font-mono font-bold rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Stage Location</label>
              <input
                type="text"
                value={newLoc}
                onChange={e => setNewLoc(e.target.value)}
                maxLength={60}
                placeholder="e.g. Stage-04LH"
                className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none"
              />
            </div>
          </div>
          {extraFields.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Custom Attributes</p>
              {extraFields.map((f, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={f.key}
                    onChange={e => updateExtraField(i, 'key', e.target.value)}
                    placeholder="Field name"
                    className="w-40 p-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none font-semibold"
                  />
                  <input
                    type="text"
                    value={f.val}
                    onChange={e => updateExtraField(i, 'val', e.target.value)}
                    placeholder="Value"
                    className="flex-1 p-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeExtraField(i)}
                    className="text-rose-500 hover:text-rose-700 font-bold text-base px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-5 rounded-lg shadow uppercase tracking-wider transition-all"
            >
              Add Asset
            </button>
            <button
              type="button"
              onClick={addExtraField}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2.5 px-4 rounded-lg border border-indigo-200 transition-all"
            >
              + Add Custom Field
            </button>
          </div>
        </form>
      </div>

      {/* ── Asset Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
          Registered Line Equipment & Node States ({assets.length})
        </h3>

        {assets.length === 0 ? (
          <p className="text-center text-slate-400 italic text-xs py-8">
            No assets registered yet. Import an Excel inventory or register assets manually above.
          </p>
        ) : (
          <>
            {/* ── Mobile View ── */}
            <div className="md:hidden space-y-3">
              {assets.map(a => (
                <div key={a.id} className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{a.componentName}</span>
                    <span
                      className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                        a.statusFlag === 'FAULT'
                          ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      ● {a.statusFlag}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <span className="text-slate-400 font-semibold">Category</span>
                    <span className="text-slate-700 font-bold uppercase">{a.category}</span>
                    <span className="text-slate-400 font-semibold">Make</span>
                    <span className="text-slate-700">{a.make || '—'}</span>
                    <span className="text-slate-400 font-semibold">Serial</span>
                    <span className="font-mono text-slate-600">{a.controllerSerial || '—'}</span>
                    <span className="text-slate-400 font-semibold">IP</span>
                    <span className="font-mono text-indigo-600 font-bold">{fmtIp(a.ipAddress)}</span>
                    <span className="text-slate-400 font-semibold">Location</span>
                    <span className="text-slate-700">{a.stageLocation || '—'}</span>
                  </div>
                  <div className="flex gap-2 pt-1 border-t border-slate-200">
                    <label className="flex-1 text-center cursor-pointer bg-slate-900 text-white font-bold py-2 rounded-lg text-[11px]">
                      Upload QR
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async e => {
                          if (e.target.files?.[0]) {
                            try {
                              const b64 = await compressAndEncodeImage(e.target.files[0], 400);
                              update(ref(db, `assets/${a.id}`), { sopQrCode: b64 })
                                .then(() => addToast("QR updated.", "success"))
                                .catch(err => addToast(`Failed: ${err.message}`, "error"));
                            } catch (err: any) {
                              addToast(err.message, "error");
                            }
                          }
                        }}
                      />
                    </label>
                    {userRole === 'Technician' && (
                      <button
                        onClick={() => startEdit(a)}
                        className="flex-1 bg-indigo-600 text-white font-bold py-2 rounded-lg text-[11px]"
                      >
                        Modify
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop View ── */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-200 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-4">Asset Tag</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Make</th>
                    <th className="p-4">Controller Serial</th>
                    <th className="p-4">IP Address</th>
                    <th className="p-4">Location</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {assets.map((a, idx) => {
                    const isEditing = editingId === a.id;
                    return (
                      <tr key={a.id} className={idx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}>
                        <td className="p-4 font-bold text-slate-900">
                          {isEditing ? iCell('componentName', 'Asset name') : a.componentName}
                        </td>
                        <td className="p-4">
                          {isEditing ? (
                            <select
                              value={editData.category || a.category}
                              onChange={e => setEditData({ ...editData, category: e.target.value })}
                              className="p-1.5 bg-white border border-indigo-400 rounded-lg text-slate-900 outline-none text-[11px] font-bold"
                            >
                              <option>Tools</option>
                              <option>TVs &amp; Scanners</option>
                              <option>UPS</option>
                              <option>Panels</option>
                            </select>
                          ) : (
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold text-[10px] uppercase border border-slate-200">
                              {a.category}
                            </span>
                          )}
                        </td>
                        <td className="p-4 font-semibold text-slate-700">
                          {isEditing ? iCell('make', 'Make') : a.make || '—'}
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-600">
                          {isEditing ? iCell('controllerSerial', 'Serial') : a.controllerSerial || '—'}
                        </td>
                        <td className="p-4 font-mono text-indigo-600 font-bold">
                          {isEditing ? iCell('ipAddress', 'IP') : fmtIp(a.ipAddress)}
                        </td>
                        <td className="p-4 text-slate-600 font-semibold">
                          {isEditing ? iCell('stageLocation', 'Location') : a.stageLocation}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded font-extrabold text-[10px] tracking-wide ${
                              a.statusFlag === 'FAULT'
                                ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            ● NODE {a.statusFlag}
                          </span>
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="space-y-2">
                              {editExtra.map((f, i) => (
                                <div key={i} className="flex gap-1 items-center justify-end">
                                  <input
                                    type="text"
                                    value={f.key}
                                    onChange={e =>
                                      setEditExtra(ex =>
                                        ex.map((x, xi) => (xi === i ? { ...x, key: e.target.value } : x))
                                      )
                                    }
                                    className="w-24 p-1 text-[10px] border border-indigo-300 rounded text-slate-800 outline-none"
                                    placeholder="Field"
                                  />
                                  <input
                                    type="text"
                                    value={f.val}
                                    onChange={e =>
                                      setEditExtra(ex =>
                                        ex.map((x, xi) => (xi === i ? { ...x, val: e.target.value } : x))
                                      )
                                    }
                                    className="w-28 p-1 text-[10px] border border-indigo-300 rounded text-slate-800 outline-none"
                                    placeholder="Value"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setEditExtra(ex => ex.filter((_, xi) => xi !== i))}
                                    className="text-rose-500 text-xs font-bold"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                              <div className="flex items-center gap-1.5 justify-end">
                                <button
                                  type="button"
                                  onClick={() => setEditExtra(ex => [...ex, { key: '', val: '' }])}
                                  className="text-[10px] text-indigo-500 font-bold underline"
                                >
                                  +field
                                </button>
                                <button
                                  onClick={() => saveEdit(a.id)}
                                  className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 justify-end">
                              {Object.keys(a.customFields || {}).length > 0 && (
                                <span className="text-[9px] text-slate-400 italic">
                                  +{Object.keys(a.customFields || {}).length} fields
                                </span>
                              )}
                              {a.sopQrCode ? (
                                <img
                                  src={a.sopQrCode}
                                  alt="QR"
                                  className="w-8 h-8 rounded border border-slate-300 shadow-sm bg-white cursor-default"
                                />
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">No QR</span>
                              )}
                              <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] tracking-wide transition-all shadow-sm">
                                Upload QR
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async e => {
                                    if (e.target.files?.[0]) {
                                      try {
                                        const b64 = await compressAndEncodeImage(e.target.files[0], 400);
                                        update(ref(db, `assets/${a.id}`), { sopQrCode: b64 })
                                          .then(() => addToast("QR updated.", "success"))
                                          .catch(err => addToast(`Failed: ${err.message}`, "error"));
                                      } catch (err: any) {
                                        addToast(err.message, "error");
                                      }
                                    }
                                  }}
                                />
                              </label>
                              {userRole === 'Technician' && (
                                <button
                                  onClick={() => startEdit(a)}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] tracking-wide transition-all shadow-sm"
                                >
                                  Modify
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
