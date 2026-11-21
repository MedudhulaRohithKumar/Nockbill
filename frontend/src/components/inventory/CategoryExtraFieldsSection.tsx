import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { CategoryRuleConfig } from '../../config/inventoryCategories';
import { CustomSelect } from '../common/CustomSelect';

interface CategoryExtraFieldsSectionProps {
  config: CategoryRuleConfig;
  attributes: Record<string, string | number | boolean | undefined>;
  onChange: (nextAttributes: Record<string, string | number | boolean | undefined>) => void;
}

const TOXICITY_DOT_CLASSES: Record<string, string> = {
  Red: 'bg-red-600 ring-red-200',
  Yellow: 'bg-amber-400 ring-amber-200',
  Blue: 'bg-blue-600 ring-blue-200',
  Green: 'bg-emerald-600 ring-emerald-200',
};

export const CategoryExtraFieldsSection: React.FC<CategoryExtraFieldsSectionProps> = ({
  config,
  attributes,
  onChange,
}) => {
  if (!config.extraFields || config.extraFields.length === 0) {
    return null;
  }

  const updateField = (key: string, value: string) => {
    onChange({
      ...attributes,
      [key]: value,
    });
  };

  const visibleFields = config.extraFields.filter((field) => {
    if (!field.showWhen) return true;
    const controllingVal = String(attributes[field.showWhen.field] ?? '');
    return field.showWhen.values.includes(controllingVal);
  });

  return (
    <div className={`rounded-xl border p-3.5 space-y-3 ${config.accentBgClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0" />
          <div>
            <h4 className="font-bold text-slate-900 text-xs">
              {config.label} Compliance &amp; Technical Specifications
            </h4>
            <p className="text-[10px] text-slate-600">
              {config.shortDescription}
            </p>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${config.badgeClass}`}>
          {config.regulationTag}
        </span>
      </div>

      <div className={`grid grid-cols-1 ${visibleFields.length > 1 ? 'sm:grid-cols-2' : ''} gap-3`}>
        {visibleFields.map((field) => {
          const inputId = `cat-extra-${config.id.toLowerCase()}-${field.key}`;
          const currentValue = String(attributes[field.key] ?? '');

          if (field.type === 'select' && field.options) {
            const toxDot = field.key === 'toxicity_color' ? TOXICITY_DOT_CLASSES[currentValue] : undefined;
            return (
              <div key={field.key}>
                <label className="block font-semibold text-slate-700">
                  <span className="flex items-center gap-1.5 mb-1">
                    <span>{field.label}</span>
                    {toxDot && (
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ring-2 ${toxDot}`}
                        title={`Toxicity triangle: ${currentValue}`}
                      />
                    )}
                  </span>
                  <CustomSelect
                    value={currentValue}
                    onChange={(val) => updateField(field.key, val)}
                    placeholder={field.placeholder || `Select ${field.label}`}
                    options={[
                      { value: '', label: `— None / Not Specified —` },
                      ...field.options.map((opt) => ({ value: opt.value, label: opt.label })),
                    ]}
                  />
                </label>
                {field.helperText && (
                  <p className="text-[10px] text-slate-500 mt-1">{field.helperText}</p>
                )}
              </div>
            );
          }

          return (
            <div key={field.key} className={field.quickChips && visibleFields.length === 1 ? 'col-span-full' : ''}>
              <label htmlFor={inputId} className="block font-semibold text-slate-700 mb-1">
                {field.label}
              </label>
              <input
                id={inputId}
                type={field.type === 'number' ? 'number' : 'text'}
                maxLength={150}
                value={currentValue}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder={field.placeholder || ''}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
              />
              {field.helperText && (
                <p className="text-[10px] text-slate-500 mt-1">{field.helperText}</p>
              )}
              {field.quickChips && field.quickChips.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  {field.quickChips.map((chip) => {
                    const isSelected = currentValue === chip;
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => updateField(field.key, chip)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
