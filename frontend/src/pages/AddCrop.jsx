import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFarmData } from "../hooks/useFarmData";
import { useT } from "../hooks/useTranslation";
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  MapPin,
  StickyNote,
  Upload,
  Sprout,
  Clock,
  ChevronRight,
  LayoutGrid,
  Leaf,
} from "lucide-react";
import {
  PageShell,
  PageHeader,
  IconButton,
  SectionCard,
} from "../components/ui";
import { createCrop, fetchDashboardData } from "../api/farmApi";
import {
  CROP_LIFECYCLES,
  CROP_CYCLE_HOURS,
  SUPPORTED_CROPS,
} from "../utils/dataUtils";

// Lifecycle Timeline Component
function LifecycleTimeline({ cropName }) {
  const lc = CROP_LIFECYCLES[cropName?.toLowerCase()];
  if (!lc) return null;

  const total = lc.totalHours;
  const colors = [
    "var(--text-3)",
    "var(--green)",
    "var(--amber)",
    "var(--red)",
  ];

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          gap: 0,
          borderRadius: 6,
          overflow: "hidden",
          height: 10,
          marginBottom: 8,
        }}
      >
        {lc.stages.map((s, i) => {
          const endH = s.endH ?? total;
          const width = ((endH - s.startH) / total) * 100;
          return (
            <div
              key={s.name}
              style={{
                width: `${width}%`,
                background: colors[i % colors.length],
                opacity: 0.7,
              }}
              title={`${s.name}: ${s.startH}h–${s.endH ?? "harvest"}h`}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {lc.stages.map((s, i) => (
          <div
            key={s.name}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: colors[i % colors.length],
                display: "inline-block",
                opacity: 0.8,
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontFamily: "DM Mono, monospace",
                color: "var(--text-3)",
                textTransform: "capitalize",
              }}
            >
              {s.name}
              {s.endH
                ? ` (${Math.round((s.endH - s.startH) / 24)}d)`
                : " (harvest)"}
            </span>
          </div>
        ))}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            fontFamily: "DM Mono, monospace",
            color: "var(--text-3)",
          }}
        >
          Total: ~{lc.totalDays} days
        </span>
      </div>
    </div>
  );
}

// MAIN

export default function AddCrop() {
  const navigate = useNavigate();
  const { refreshData } = useFarmData();
  const { t } = useT();

  const [form, setForm] = useState({
    crop_id: "",
    crop: "Lettuce",
    location: "",
    notes: "",
  });

  const [sensorIds, setSensorIds] = useState({
    ph_sensor: "",
    ec_sensor: "",
    temp_sensor: "",
    humidity_sensor: "",
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [createdId, setCreatedId] = useState("");

  // Auto-generate crop_id suggestion when crop type changes
  useEffect(() => {
    if (!form.crop_id) {
      const year = new Date().getFullYear();
      const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      setForm((f) => ({
        ...f,
        crop_id: `Batch_${form.crop}_${year}${letter}`,
      }));
    }
  }, [form.crop]); // eslint-disable-line react-hooks/exhaustive-deps

  const cycleDuration = CROP_CYCLE_HOURS[form.crop?.toLowerCase()] || 1;

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setError("");
    if (!form.crop_id.trim()) {
      setError("Crop ID is required.");
      return;
    }
    if (!form.crop) {
      setError("Please select a crop type.");
      return;
    }

    setSubmitting(true);
    try {
      // Check uniqueness
      const existing = await fetchDashboardData();
      const ids = (existing || [])
        .map((d) => d.crop_id || d.payload?.crop_id)
        .filter(Boolean);
      if (ids.includes(form.crop_id.trim())) {
        setError(t("add_crop_id_exists"));
        setSubmitting(false);
        return;
      }

      const payload = {
        crop_id: form.crop_id.trim(),
        crop: form.crop,
        location: form.location,
        notes: form.notes,
        sensor_ids: sensorIds,
        // image_url: upload to storage
      };

      await createCrop(payload);
      await refreshData();
      setCreatedId(form.crop_id.trim());
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to register crop.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <PageShell>
        <PageHeader>
          <IconButton onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={15} />
          </IconButton>
          <h1 className="page-title">{t("add_title")}</h1>
        </PageHeader>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
          }}
        >
          <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(74,222,128,0.12)",
                border: "1px solid rgba(74,222,128,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <CheckCircle2 size={34} style={{ color: "var(--green)" }} />
            </div>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 8,
              }}
            >
              {t("add_register_success")}
            </h2>
            <p
              style={{
                fontSize: 13,
                fontFamily: "DM Mono, monospace",
                color: "var(--text-3)",
                marginBottom: 32,
              }}
            >
              {createdId}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={() => navigate(`/run-cycle/${createdId}`)}
                style={{
                  padding: "14px 24px",
                  borderRadius: 12,
                  background: "var(--green)",
                  border: "none",
                  color: "var(--btn-on-green)",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {t("add_run_first_cycle")} <ChevronRight size={16} />
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                style={{
                  padding: "12px 24px",
                  borderRadius: 12,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-2)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <LayoutGrid size={15} /> {t("add_view_dashboard")}
              </button>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  // Form state
  return (
    <PageShell>
      <PageHeader>
        <IconButton onClick={() => navigate("/dashboard")}>
          <ArrowLeft size={15} />
        </IconButton>
        <div>
          <h1 className="page-title">{t("add_title")}</h1>
          <p className="page-subtitle">{t("add_subtitle")}</p>
        </div>
      </PageHeader>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          width: "100%",
        }}
      >
        {/* Crop Type */}
        <SectionCard>
          <div className="section-label" style={{ marginBottom: 16 }}>
            {t("add_field_crop_type")}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10,
            }}
          >
            {SUPPORTED_CROPS.map((c) => (
              <button
                key={c}
                onClick={() => setForm((f) => ({ ...f, crop: c, crop_id: "" }))}
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: `2px solid ${form.crop === c ? "var(--green)" : "var(--border)"}`,
                  background:
                    form.crop === c
                      ? "rgba(74,222,128,0.08)"
                      : "var(--surface)",
                  color: form.crop === c ? "var(--green)" : "var(--text-2)",
                  fontWeight: form.crop === c ? 700 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.15s",
                }}
              >
                <Leaf size={14} />
                {c}
                {form.crop === c && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      fontFamily: "DM Mono, monospace",
                      opacity: 0.7,
                    }}
                  >
                    {CROP_CYCLE_HOURS[c.toLowerCase()]}h/cycle
                  </span>
                )}
              </button>
            ))}
          </div>
        </SectionCard>

        {/* Growth Timeline */}
        {form.crop && (
          <SectionCard>
            <div className="section-label" style={{ marginBottom: 8 }}>
              {t("add_lifecycle_label")}
            </div>
            <LifecycleTimeline cropName={form.crop} />
          </SectionCard>
        )}

        {/* Crop ID */}
        <SectionCard>
          <div className="section-label" style={{ marginBottom: 12 }}>
            {t("add_field_crop_id")}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 10,
              background: "var(--bg-3)",
              border: `1px solid ${error.includes("ID") ? "var(--red)" : "var(--border)"}`,
            }}
          >
            <Database
              size={14}
              style={{ color: "var(--text-3)", flexShrink: 0 }}
            />
            <input
              type="text"
              value={form.crop_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, crop_id: e.target.value }))
              }
              placeholder={`e.g. Batch_${form.crop}_2025A`}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "var(--text)",
                fontSize: 13,
                fontFamily: "DM Mono, monospace",
              }}
            />
          </div>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              marginTop: 6,
              fontFamily: "DM Mono, monospace",
            }}
          >
            {t("add_field_crop_id_hint")}
          </p>
          {error.includes("ID") && (
            <p
              style={{
                fontSize: 11,
                color: "var(--red)",
                marginTop: 4,
                fontFamily: "DM Mono, monospace",
              }}
            >
              {error}
            </p>
          )}
        </SectionCard>

        {/* Sensor Assignment */}
        <SectionCard>
          <div className="section-label" style={{ marginBottom: 12 }}>
            Sensor Assignment
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            {[
              { key: "ph_sensor", label: "pH Sensor", color: "var(--green)" },
              { key: "ec_sensor", label: "EC Sensor", color: "var(--amber)" },
              { key: "temp_sensor", label: "Temp Sensor", color: "var(--red)" },
              {
                key: "humidity_sensor",
                label: "Humidity Sensor",
                color: "#a78bfa",
              },
            ].map(({ key, label, color }) => (
              <div
                key={key}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "var(--bg-3)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: "DM Mono, monospace",
                    color: "var(--text-3)",
                    marginBottom: 6,
                  }}
                >
                  {label}
                </div>
                <input
                  type="text"
                  value={sensorIds[key]}
                  onChange={(e) =>
                    setSensorIds((s) => ({ ...s, [key]: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    background: "none",
                    border: "none",
                    outline: "none",
                    color,
                    fontFamily: "DM Mono, monospace",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                />
              </div>
            ))}
          </div>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              marginTop: 8,
              fontFamily: "DM Mono, monospace",
            }}
          >
            Leave blank to auto-assign, or enter your physical sensor labels.
          </p>
        </SectionCard>

        {/* Auto: cycle duration + stage */}
        <SectionCard>
          <div className="section-label" style={{ marginBottom: 12 }}>
            {t("add_auto_cycle_duration")}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: 10,
                background: "rgba(74,222,128,0.06)",
                border: "1px solid rgba(74,222,128,0.2)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <Clock size={12} style={{ color: "var(--green)" }} />
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "DM Mono, monospace",
                    color: "var(--text-3)",
                  }}
                >
                  {t("add_auto_cycle_duration")}
                </span>
              </div>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--green)",
                  fontFamily: "DM Mono, monospace",
                }}
              >
                {cycleDuration}h
              </span>
            </div>
            <div
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: 10,
                background: "var(--bg-3)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <Sprout size={12} style={{ color: "var(--text-3)" }} />
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "DM Mono, monospace",
                    color: "var(--text-3)",
                  }}
                >
                  Initial Stage
                </span>
              </div>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text-2)",
                  fontFamily: "DM Mono, monospace",
                  textTransform: "capitalize",
                }}
              >
                Seedling
              </span>
            </div>
          </div>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              marginTop: 8,
              fontFamily: "DM Mono, monospace",
            }}
          >
            {t("add_auto_cycle_hint", {
              crop: form.crop,
              hours: cycleDuration,
            })}
          </p>
        </SectionCard>

        {/* Location */}
        <SectionCard>
          <div className="section-label" style={{ marginBottom: 12 }}>
            {t("add_field_location")}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 10,
              background: "var(--bg-3)",
              border: "1px solid var(--border)",
            }}
          >
            <MapPin
              size={14}
              style={{ color: "var(--text-3)", flexShrink: 0 }}
            />
            <input
              type="text"
              value={form.location}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
              placeholder={t("add_field_location_placeholder")}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "var(--text)",
                fontSize: 13,
                fontFamily: "DM Mono, monospace",
              }}
            />
          </div>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              marginTop: 6,
              fontFamily: "DM Mono, monospace",
            }}
          >
            {t("add_field_location_hint")}
          </p>
        </SectionCard>

        {/* Notes */}
        <SectionCard>
          <div className="section-label" style={{ marginBottom: 12 }}>
            {t("add_field_notes")}
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 10,
              background: "var(--bg-3)",
              border: "1px solid var(--border)",
            }}
          >
            <StickyNote
              size={14}
              style={{ color: "var(--text-3)", flexShrink: 0, marginTop: 2 }}
            />
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder={t("add_field_notes_placeholder")}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "var(--text)",
                fontSize: 13,
                fontFamily: "DM Mono, monospace",
                resize: "vertical",
                lineHeight: 1.6,
              }}
            />
          </div>
        </SectionCard>

        {/* Image (optional) */}
        <SectionCard>
          <div className="section-label" style={{ marginBottom: 12 }}>
            {t("add_plant_image")}
          </div>
          {imagePreview ? (
            <div
              style={{
                position: "relative",
                borderRadius: 12,
                overflow: "hidden",
                height: 160,
              }}
            >
              <img
                src={imagePreview}
                alt="crop preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <button
                onClick={() => {
                  setImageFile(null);
                  setImagePreview(null);
                }}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  padding: "4px 10px",
                  borderRadius: 8,
                  background: "rgba(0,0,0,0.6)",
                  border: "none",
                  color: "#fff",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
          ) : (
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: 24,
                borderRadius: 12,
                border: "2px dashed var(--border)",
                cursor: "pointer",
                background: "var(--bg-3)",
              }}
            >
              <Upload size={22} style={{ color: "var(--text-3)" }} />
              <span
                style={{
                  fontSize: 12,
                  fontFamily: "DM Mono, monospace",
                  color: "var(--text-3)",
                }}
              >
                {t("add_drop_image")}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "DM Mono, monospace",
                  color: "var(--text-3)",
                  opacity: 0.6,
                }}
              >
                {t("add_image_hint")}
              </span>
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleImageChange}
              />
            </label>
          )}
        </SectionCard>

        {/* Error */}
        {error && !error.includes("ID") && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              fontSize: 12,
              fontFamily: "DM Mono, monospace",
              color: "var(--red)",
            }}
          >
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: "15px 24px",
            borderRadius: 12,
            background: submitting ? "var(--border)" : "var(--green)",
            border: "none",
            color: submitting ? "var(--text-3)" : "var(--btn-on-green)",
            fontWeight: 700,
            fontSize: 14,
            cursor: submitting ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.2s",
            marginBottom: 24,
          }}
        >
          <Leaf size={15} />
          {submitting ? t("add_registering") : t("add_register_btn")}
        </button>
      </div>
    </PageShell>
  );
}
