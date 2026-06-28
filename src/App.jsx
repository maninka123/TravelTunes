import {
  Camera,
  Check,
  Copy,
  Globe2,
  ImagePlus,
  Loader2,
  MapPin,
  Music2,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { COUNTRIES, defaultLanguagesFor } from "./data/countries";
import { postJson, readFileAsPayload } from "./lib/api";
import { getGpsFromPhoto, reverseGeocodeCountry } from "./lib/location";

const MAX_PHOTOS = 3;

const DEMO_SONGS = [
  {
    title: "Manike Mage Hithe",
    artist: "Yohani",
    language: "Sinhala",
    tier: 1,
    reason: "Bright Sinhala pop that fits sunlit travel memories.",
  },
  {
    title: "Paradise",
    artist: "Coldplay",
    language: "English",
    tier: 1,
    reason: "A wide, scenic hook for postcard-style moments.",
  },
  {
    title: "Bella Ciao",
    artist: "Traditional",
    language: "Local",
    tier: 2,
    reason: "A familiar regional classic when the place calls for tradition.",
  },
];

function App() {
  const [photos, setPhotos] = useState([]);
  const [country, setCountry] = useState("Sri Lanka");
  const [detectedCountry, setDetectedCountry] = useState("");
  const [locationStatus, setLocationStatus] = useState("Upload photos to detect country from EXIF GPS.");
  const [energy, setEnergy] = useState(62);
  const [style, setStyle] = useState(44);
  const [model, setModel] = useState("gemini");
  const [languages, setLanguages] = useState(defaultLanguagesFor("Sri Lanka"));
  const [customLanguage, setCustomLanguage] = useState("");
  const [tierOneCount, setTierOneCount] = useState(5);
  const [mood, setMood] = useState(null);
  const [songs, setSongs] = useState(DEMO_SONGS);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);

  const modelLabel = model === "gemini" ? "Gemini" : "Qwen";
  const canRun = photos.length > 0 && country;

  useEffect(() => {
    setLanguages((current) => {
      const next = defaultLanguagesFor(country);
      return Array.from(new Set([...next, ...current]));
    });
  }, [country]);

  async function handlePhotos(event) {
    const selected = Array.from(event.target.files || []).slice(0, MAX_PHOTOS);
    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    const nextPhotos = selected.map((file) => ({
      id: `${file.name}-${file.lastModified}-${file.size}`,
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
    }));
    setPhotos(nextPhotos);
    setMood(null);

    if (!nextPhotos.length) {
      setLocationStatus("Upload photos to detect country from EXIF GPS.");
      return;
    }

    setLocationStatus("Checking photo GPS...");
    for (const photo of nextPhotos) {
      const gps = await getGpsFromPhoto(photo.file);
      if (!gps) continue;

      try {
        const place = await reverseGeocodeCountry(gps);
        if (place) {
          setDetectedCountry(place);
          setCountry(place);
          setLocationStatus(`Detected ${place} from photo GPS. You can still override it.`);
          return;
        }
      } catch {
        break;
      }
    }

    setDetectedCountry("");
    setLocationStatus("No usable GPS found. Choose the country manually.");
  }

  function addLanguage() {
    const value = customLanguage.trim();
    if (!value) return;
    setLanguages((current) => Array.from(new Set([...current, value])));
    setCustomLanguage("");
  }

  function removeLanguage(language) {
    setLanguages((current) => current.filter((item) => item !== language));
  }

  async function readMood() {
    if (!canRun) return;
    setBusy("vision");
    setStatus(`Reading photo mood with ${modelLabel}...`);
    try {
      const imagePayloads = await Promise.all(photos.map((photo) => readFileAsPayload(photo.file)));
      const data = await postJson("/api/vision", {
        model,
        country,
        energy,
        style,
        photos: imagePayloads,
      });
      setMood(data.mood);
      if (Number.isFinite(data.mood?.energy)) setEnergy(data.mood.energy);
      setStatus(data.demo ? "Mood read used demo mode because the selected model key is missing." : "Mood read complete.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy("");
    }
  }

  async function findSongs() {
    if (!canRun) return;
    setBusy("songs");
    setCopied(false);
    setStatus("Building song list...");
    try {
      const songData = await postJson("/api/songs", {
        model,
        country,
        energy,
        style,
        languages,
        tierOneCount,
        mood,
      });

      setStatus("Checking YouTube results...");
      const hydrated = await Promise.all(
        songData.songs.map(async (song) => {
          try {
            const video = await postJson("/api/youtube", {
              query: `${song.title} ${song.artist}`,
            });
            return { ...song, ...video };
          } catch {
            return song;
          }
        }),
      );

      setSongs(hydrated);
      setStatus(songData.demo ? "Song list used demo mode because a model key is missing." : "Song list ready.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy("");
    }
  }

  async function copyList() {
    const text = songs.map((song, index) => `${index + 1}. ${song.title} - ${song.artist}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  const countryOptions = useMemo(() => Array.from(new Set([country, ...COUNTRIES])).filter(Boolean), [country]);

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="TravelTunes song picker">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <Music2 size={20} />
            </span>
            <div>
              <h1>TravelTunes</h1>
              <p>Photo mood to country-aware songs.</p>
            </div>
          </div>
          <button className="icon-button" type="button" onClick={() => window.location.reload()} aria-label="Reset">
            <RotateCcw size={18} />
          </button>
        </header>

        <div className="panel upload-panel">
          <div className="section-heading">
            <span>
              <Camera size={18} />
              Photos
            </span>
            <small>{photos.length}/{MAX_PHOTOS}</small>
          </div>
          <label className="upload-target">
            <input type="file" accept="image/*" multiple onChange={handlePhotos} />
            <ImagePlus size={22} />
            <span>Add up to 3 photos</span>
          </label>
          <div className="thumb-row">
            {Array.from({ length: MAX_PHOTOS }).map((_, index) => {
              const photo = photos[index];
              return (
                <div className="thumb" key={index}>
                  {photo ? <img src={photo.previewUrl} alt={photo.name} /> : <ImagePlus size={18} />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="section-heading">
            <span>
              <MapPin size={18} />
              Country
            </span>
            {detectedCountry ? <small>GPS</small> : <small>Manual</small>}
          </div>
          <select value={country} onChange={(event) => setCountry(event.target.value)}>
            {countryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <p className="hint">{locationStatus}</p>
        </div>

        <div className="panel">
          <div className="section-heading">
            <span>
              <SlidersHorizontal size={18} />
              Vibe
            </span>
          </div>
          <Slider label="Energy" left="Quiet" right="Energetic" value={energy} onChange={setEnergy} />
          <Slider label="Style" left="Traditional" right="Mainstream" value={style} onChange={setStyle} />
        </div>

        <div className="panel">
          <div className="section-heading">
            <span>
              <Globe2 size={18} />
              Languages
            </span>
            <small>{tierOneCount} tier-1</small>
          </div>
          <div className="chip-row">
            {languages.map((language) => (
              <button className="chip selected" type="button" key={language} onClick={() => removeLanguage(language)}>
                {language}
                <X size={14} />
              </button>
            ))}
          </div>
          <div className="inline-form">
            <input
              value={customLanguage}
              onChange={(event) => setCustomLanguage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addLanguage();
              }}
              placeholder="Add language or country"
            />
            <button type="button" onClick={addLanguage}>Add</button>
          </div>
          <input
            aria-label="Tier one count"
            className="thin-range"
            type="range"
            min="2"
            max="8"
            value={tierOneCount}
            onChange={(event) => setTierOneCount(Number(event.target.value))}
          />
        </div>

        <div className="panel model-panel">
          <div className="section-heading">
            <span>
              <Sparkles size={18} />
              Model
            </span>
          </div>
          <div className="segment" role="tablist" aria-label="Vision model">
            <button className={model === "gemini" ? "active" : ""} type="button" onClick={() => setModel("gemini")}>
              Gemini
            </button>
            <button className={model === "qwen" ? "active" : ""} type="button" onClick={() => setModel("qwen")}>
              Qwen
            </button>
          </div>
          <button className="secondary-action" type="button" onClick={readMood} disabled={!canRun || busy === "vision"}>
            {busy === "vision" ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}
            Read mood
          </button>
          {mood ? (
            <div className="mood-strip">
              <strong>{mood.setting || "Travel scene"}</strong>
              <span>{mood.mood || "balanced, scenic, warm"}</span>
            </div>
          ) : null}
        </div>

        <button className="primary-action" type="button" onClick={findSongs} disabled={!canRun || busy === "songs"}>
          {busy === "songs" ? <Loader2 className="spin" size={19} /> : <Play size={19} />}
          Find songs
        </button>

        {status ? <p className="status">{status}</p> : null}

        <section className="songs" aria-label="Song results">
          <div className="songs-head">
            <h2>Songs</h2>
            <button className="copy-button" type="button" onClick={copyList} disabled={!songs.length}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="song-list">
            {songs.map((song, index) => (
              <SongCard song={song} key={`${song.title}-${song.artist}-${index}`} />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function Slider({ label, left, right, value, onChange }) {
  return (
    <label className="slider-block">
      <span className="slider-title">
        {label}
        <strong>{value}</strong>
      </span>
      <input type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <span className="slider-labels">
        <small>{left}</small>
        <small>{right}</small>
      </span>
    </label>
  );
}

function SongCard({ song }) {
  return (
    <article className="song-card">
      <div className="song-meta">
        <div>
          <h3>{song.title}</h3>
          <p>{song.artist}</p>
        </div>
        <span className="tier">Tier {song.tier || 2}</span>
      </div>
      {song.videoId ? (
        <iframe
          title={`${song.title} by ${song.artist}`}
          src={`https://www.youtube.com/embed/${song.videoId}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <a className="youtube-link" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.title} ${song.artist}`)}`} target="_blank" rel="noreferrer">
          Search on YouTube
        </a>
      )}
      <div className="song-foot">
        <span>{song.language || "Music"}</span>
        <p>{song.reason || "Picked for this travel mood."}</p>
      </div>
    </article>
  );
}

export default App;
