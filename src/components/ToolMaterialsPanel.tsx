import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { ref, onValue, set, update } from 'firebase/database';
import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { ToolMaterialEntry } from '../types';
import { ToastContext } from '../context/AppContext';

export function ToolMaterialsPanel() {
  const { addToast } = useContext(ToastContext);
  const [materialsData, setMaterialsData] = useState<Record<string, ToolMaterialEntry[]>>({});
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [materialSearch, setMaterialSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editCount, setEditCount] = useState('');
  const [editStageCode, setEditStageCode] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);
  const [addRow, setAddRow] = useState({ material: '', assetNo: '', count: '', stageCode: '' });

  useEffect(() => {
    const unsub = onValue(ref(db, 'toolMaterials'), snap => {
      setMaterialsLoading(false);
      const data = snap.val();
      if (!data) {
        setMaterialsData({});
        return;
      }
      const parsed: Record<string, ToolMaterialEntry[]> = {};
      Object.keys(data).forEach(material => {
        const assetsObj = data[material] || {};
        parsed[material] = Object.keys(assetsObj)
          .map(assetNo => {
            const val = assetsObj[assetNo];
            const count = typeof val === 'object' && val !== null ? Number(val.count) || 0 : Number(val) || 0;
            const stageCode = typeof val === 'object' && val !== null ? val.stageCode || '' : '';
            const assetName = typeof val === 'object' && val !== null ? val.assetName || '' : '';
            return { assetNo, assetName, count, stageCode };
          })
          .filter(e => e.count > 0);
      });
      setMaterialsData(parsed);
    });
    return () => unsub();
  }, []);

  const allMaterials = useMemo(() => Object.keys(materialsData).sort(), [materialsData]);
  const filteredMaterials = useMemo(
    () =>
      allMaterials.filter(
        m => m.toLowerCase().includes(materialSearch.toLowerCase()) && !selectedMaterials.includes(m)
      ),
    [allMaterials, materialSearch, selectedMaterials]
  );

  const mergedRows = useMemo(() => {
    const map = new Map<
      string,
      { assetNo: string; assetName: string; count: number; stageCode: string; materials: string[] }
    >();
    selectedMaterials.forEach(mat => {
      (materialsData[mat] || []).forEach(entry => {
        if (entry.count <= 0) return;
        const existing = map.get(entry.assetNo);
        if (existing) {
          existing.count += entry.count;
          existing.materials.push(mat);
        } else {
          map.set(entry.assetNo, {
            assetNo: entry.assetNo,
            assetName: entry.assetName || '',
            count: entry.count,
            stageCode: entry.stageCode || '',
            materials: [mat]
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.assetNo.localeCompare(b.assetNo));
  }, [selectedMaterials, materialsData]);

  const handleExcelImport = useCallback(
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
          const colMap: Record<string, string> = {};
          Object.keys(rows[0]).forEach(col => {
            const key = col.trim().toLowerCase().replace(/[\s_.]+/g, '');
            if (key === 'materialcode' || key === 'material' || key === 'vehiclemodel') colMap.material = col;
            else if (key === 'assetno' || key === 'assetid' || key === 'toolid') colMap.asset = col;
            else if (key === 'count' || key === 'qty' || key === 'quantity') colMap.count = col;
            else if (key === 'stagecode' || key === 'stage') colMap.stageCode = col;
            else if (key === 'assetname' || key === 'toolname') colMap.assetName = col;
          });
          if (!colMap.material || !colMap.asset || !colMap.count) {
            addToast(
              `Excel mapping error: Found columns [${Object.keys(colMap).join(', ')}]. Required: MaterialCode, AssetNo, Count.`,
              "error"
            );
            setImporting(false);
            return;
          }
          const updates: Record<string, any> = {};
          let rowCount = 0;
          rows.forEach(row => {
            const material = String(row[colMap.material]).trim();
            const assetNo = String(row[colMap.asset]).trim();
            const count = Number(row[colMap.count]) || 0;
            const stageCode = colMap.stageCode ? String(row[colMap.stageCode] || '').trim() : '';
            const assetName = colMap.assetName ? String(row[colMap.assetName] || '').trim() : '';
            if (!material || !assetNo) return;
            const safeMat = material.replace(/[.#$\[\]/]/g, '_');
            const safeAsset = assetNo.replace(/[.#$\[\]/]/g, '_');
            updates[`/toolMaterials/${safeMat}/${safeAsset}`] = { count, stageCode, assetName };
            rowCount++;
          });
          update(ref(db), updates)
            .then(() => addToast(`Successfully imported ${rowCount} BOM entries.`, "success"))
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
    [addToast]
  );

  const saveEditCount = useCallback(
    async (material: string, assetNo: string) => {
      const num = Number(editCount);
      if (isNaN(num) || num < 0) {
        addToast("Count must be a non-negative number.", "error");
        return;
      }
      await set(
        ref(db, `toolMaterials/${material.replace(/[.#$\[\]/]/g, '_')}/${assetNo.replace(/[.#$\[\]/]/g, '_')}`),
        { count: num, stageCode: editStageCode.trim() }
      )
        .then(() => {
          addToast("BOM tool requirement updated.", "success");
          setEditingKey(null);
        })
        .catch(err => addToast(`Failed: ${err.message}`, "error"));
    },
    [editCount, editStageCode, addToast]
  );

  const deleteEntry = useCallback(
    async (material: string, assetNo: string) => {
      if (!window.confirm(`Remove ${assetNo} from ${material}?`)) return;
      await set(
        ref(db, `toolMaterials/${material.replace(/[.#$\[\]/]/g, '_')}/${assetNo.replace(/[.#$\[\]/]/g, '_')}`),
        null
      )
        .then(() => addToast("Entry removed.", "success"))
        .catch(err => addToast(`Failed: ${err.message}`, "error"));
    },
    [addToast]
  );

  const addNewEntry = useCallback(async () => {
    const material = addRow.material.trim();
    const assetNo = addRow.assetNo.trim();
    const count = Number(addRow.count);
    if (!material || !assetNo) {
      addToast("Material code and Asset No. are required.", "error");
      return;
    }
    if (isNaN(count) || count <= 0) {
      addToast("Count must be greater than zero.", "error");
      return;
    }
    await set(
      ref(db, `toolMaterials/${material.replace(/[.#$\[\]/]/g, '_')}/${assetNo.replace(/[.#$\[\]/]/g, '_')}`),
      { count, stageCode: addRow.stageCode.trim() }
    )
      .then(() => {
        addToast("BOM entry added.", "success");
        setAddRow({ material: '', assetNo: '', count: '', stageCode: '' });
        setShowAddRow(false);
      })
      .catch(err => addToast(`Failed: ${err.message}`, "error"));
  }, [addRow, addToast]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Vehicle-wise Tool Planner & BOM Matrix
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Match the day's vehicle production schedule with assembly line tools & stage locations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddRow(v => !v)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] tracking-wide transition-all shadow-sm"
            >
              + Add BOM Entry
            </button>
            <label
              className={`cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] tracking-wide transition-all shadow-sm flex items-center gap-1.5 ${
                importing ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              {importing ? '⏳ Importing...' : '📥 Import Vehicle BOM Excel'}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={importing}
                onChange={handleExcelImport}
              />
            </label>
          </div>
        </div>

        {showAddRow && (
          <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs items-end">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Vehicle / Material Code</label>
                <input
                  type="text"
                  value={addRow.material}
                  onChange={e => setAddRow({ ...addRow, material: e.target.value })}
                  maxLength={30}
                  placeholder="e.g. AL-BOSS-1415"
                  className="w-full p-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Asset / Tool No.</label>
                <input
                  type="text"
                  value={addRow.assetNo}
                  onChange={e => setAddRow({ ...addRow, assetNo: e.target.value })}
                  maxLength={20}
                  placeholder="e.g. LT0988"
                  className="w-full p-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tool Count</label>
                <input
                  type="number"
                  min="1"
                  value={addRow.count}
                  onChange={e => setAddRow({ ...addRow, count: e.target.value })}
                  placeholder="e.g. 4"
                  className="w-full p-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Stage Code</label>
                <input
                  type="text"
                  maxLength={20}
                  value={addRow.stageCode}
                  onChange={e => setAddRow({ ...addRow, stageCode: e.target.value })}
                  placeholder="e.g. 0201CH12LH"
                  className="w-full p-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900 font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addNewEntry}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition-all"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowAddRow(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
              Select Today's Scheduled Vehicle Variants
            </label>
            {selectedMaterials.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedMaterials.map(m => (
                  <span
                    key={m}
                    className="bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1.5"
                  >
                    {m}
                    <button
                      onClick={() => setSelectedMaterials(s => s.filter(x => x !== m))}
                      className="text-indigo-500 hover:text-indigo-800 font-bold"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => setSelectedMaterials([])}
                  className="text-[11px] text-rose-500 hover:text-rose-700 font-bold underline px-1"
                >
                  Clear all
                </button>
              </div>
            )}
            <div className="relative w-full md:w-96">
              <input
                type="text"
                value={materialSearch}
                onChange={e => {
                  setMaterialSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                placeholder={
                  materialsLoading
                    ? "Connecting to database..."
                    : allMaterials.length === 0
                    ? "No vehicles imported yet — use Import Excel above"
                    : "Search vehicle material code..."
                }
                className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              {showDropdown && filteredMaterials.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-y-auto max-h-52">
                  {filteredMaterials.slice(0, 50).map(m => (
                    <button
                      key={m}
                      type="button"
                      onMouseDown={() => {
                        setSelectedMaterials(s => [...s, m]);
                        setMaterialSearch('');
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-mono font-bold text-slate-800 hover:bg-slate-50 transition-all"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {materialsLoading ? (
            <div className="p-10 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin inline-block"></span>
              Loading BOM matrix from database...
            </div>
          ) : selectedMaterials.length === 0 ? (
            <div className="p-10 text-center italic text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
              Select one or more scheduled vehicle variants above to generate the prioritized tool requirements.
            </div>
          ) : mergedRows.length === 0 ? (
            <div className="p-6 text-center italic text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
              No active tools recorded for the selected vehicle variant(s).
            </div>
          ) : (
            <>
              {/* ── Mobile view ── */}
              <div className="md:hidden space-y-3">
                {mergedRows.map(row => {
                  const primaryMaterial = row.materials[0];
                  return (
                    <div key={row.assetNo} className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs bg-slate-50/50">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-indigo-600 text-sm">{row.assetNo}</span>
                        <span className="font-mono text-indigo-700 font-bold text-[11px] bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                          {row.stageCode || '—'}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-700">{row.assetName || '—'}</p>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        <span className="text-slate-400 font-semibold">Count</span>
                        <span className="font-bold">{row.count}</span>
                        <span className="text-slate-400 font-semibold">Material</span>
                        <span className="font-mono truncate">{row.materials.join(', ')}</span>
                      </div>
                      {row.materials.length === 1 && (
                        <div className="flex gap-2 pt-1 border-t border-slate-200">
                          <button
                            onClick={() => {
                              setEditingKey(`${primaryMaterial}|${row.assetNo}`);
                              setEditCount(String(row.count));
                              setEditStageCode(row.stageCode || '');
                            }}
                            className="flex-1 text-center py-2 text-[11px] text-indigo-600 font-bold border border-indigo-200 rounded-lg bg-indigo-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteEntry(primaryMaterial, row.assetNo)}
                            className="flex-1 text-center py-2 text-[11px] text-rose-500 font-bold border border-rose-200 rounded-lg bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Desktop view ── */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-3">Asset No.</th>
                      <th className="p-3">Asset Name</th>
                      <th className="p-3">Required Qty</th>
                      <th className="p-3">Stage Code</th>
                      <th className="p-3">Vehicle Model(s)</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mergedRows.map((row, idx) => {
                      const primaryMaterial = row.materials[0];
                      const editKey = `${primaryMaterial}|${row.assetNo}`;
                      const isEditing = editingKey === editKey;
                      return (
                        <tr key={row.assetNo} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="p-3 font-mono font-bold text-indigo-600">{row.assetNo}</td>
                          <td className="p-3 text-slate-700 font-semibold text-[11px]">{row.assetName || '—'}</td>
                          <td className="p-3 font-bold text-slate-900">
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                value={editCount}
                                onChange={e => setEditCount(e.target.value)}
                                className="w-20 p-1 border border-indigo-400 rounded-lg text-slate-900 outline-none font-bold"
                              />
                            ) : (
                              row.count
                            )}
                          </td>
                          <td className="p-3 font-mono text-indigo-700 font-bold text-[11px]">
                            {isEditing ? (
                              <input
                                type="text"
                                maxLength={20}
                                value={editStageCode}
                                onChange={e => setEditStageCode(e.target.value)}
                                className="w-28 p-1 border border-indigo-400 rounded-lg text-slate-900 outline-none font-mono font-bold"
                              />
                            ) : (
                              row.stageCode || '—'
                            )}
                          </td>
                          <td className="p-3 text-slate-500 font-mono text-[11px]">{row.materials.join(', ')}</td>
                          <td className="p-3 text-right whitespace-nowrap">
                            {row.materials.length > 1 ? (
                              <span className="text-[10px] text-slate-400 italic">shared tool</span>
                            ) : isEditing ? (
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => saveEditCount(primaryMaterial, row.assetNo)}
                                  className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingKey(null)}
                                  className="bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setEditingKey(editKey);
                                    setEditCount(String(row.count));
                                    setEditStageCode(row.stageCode || '');
                                  }}
                                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteEntry(primaryMaterial, row.assetNo)}
                                  className="text-[11px] text-rose-500 hover:text-rose-700 font-bold underline"
                                >
                                  Delete
                                </button>
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
    </div>
  );
}
