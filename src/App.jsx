import {
  Bot,
  BrainCircuit,
  Camera,
  Check,
  Copy,
  Globe2,
  ImagePlus,
  Loader2,
  MapPin,
  MessageSquareText,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRY_OPTIONS, defaultLanguagesFor, flagForCountry } from "./data/countries";
import { postJson, readFileAsPayload } from "./lib/api";
import { getGpsFromPhoto, reverseGeocodeCountry } from "./lib/location";

const MAX_PHOTOS = 4;

const DEMO_SONGS = [
  {
    title: "Manike Mage Hithe",
    artist: "Yohani",
    language: "Sinhala",
    tier: 1,
    reason: "Bright Sinhala pop that fits sunlit travel memories.",
  },
  {
    title: "Ayubowan",
    artist: "Dhanith Sri",
    language: "Sinhala",
    tier: 1,
    reason: "Warm local energy for Sri Lankan travel moments.",
  },
  {
    title: "Rata Riduna",
    artist: "Bathiya & Santhush",
    language: "Sinhala",
    tier: 1,
    reason: "A polished regional pick with movement and nostalgia.",
  },
  {
    title: "Saheli",
    artist: "Nanda Malini",
    language: "Sinhala",
    tier: 2,
    reason: "A softer classic for slower scenic clips.",
  },
];

function App() {
  const [photos, setPhotos] = useState([]);
  const [country, setCountry] = useState("Sri Lanka");
  const [detectedCountry, setDetectedCountry] = useState("");
  const [energy, setEnergy] = useState(62);
  const [style, setStyle] = useState(44);
  const [model, setModel] = useState("gemini");
  const [languages, setLanguages] = useState(defaultLanguagesFor("Sri Lanka"));
  const [customLanguage, setCustomLanguage] = useState("");
  const [tierOneCount, setTierOneCount] = useState(5);
  const [imageNotes, setImageNotes] = useState("");
  const [mood, setMood] = useState(null);
  const [songs, setSongs] = useState(DEMO_SONGS);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState("");
  const [activeSongKey, setActiveSongKey] = useState("");

  const canRun = photos.length > 0 && country;
  const modelLabel = model === "gemini" ? "Gemini" : "Qwen";

  useEffect(() => {
    setLanguages((current) => {
      const next = defaultLanguagesFor(country);
      return Array.from(new Set([...next, ...current]));
    });
  }, [country]);

  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, [photos]);

  async function handlePhotos(event) {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    const nextPhotos = await Promise.all(selected.map(readPhotoPreview));

    setPhotos((current) => {
      const openSlots = Math.max(0, MAX_PHOTOS - current.length);
      const addedPhotos = nextPhotos.slice(0, openSlots);
      nextPhotos.slice(openSlots).forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      return [...current, ...addedPhotos];
    });
    setMood(null);
    setStatus("");

    const detected = await detectCountry(nextPhotos);
    if (detected) {
      setDetectedCountry(detected);
      setCountry(detected);
    } else {
      setDetectedCountry("");
    }

    event.target.value = "";
  }

  function removePhoto(photoId) {
    setPhotos((current) => {
      const removed = current.find((photo) => photo.id === photoId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((photo) => photo.id !== photoId);
    });
    setMood(null);
    setStatus("");
  }

  function clearPhotos() {
    setPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      return [];
    });
    setMood(null);
    setDetectedCountry("");
    setStatus("");
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
        imageNotes,
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
    setStatus("Building song list...");
    try {
      const songData = await postJson("/api/songs", {
        model,
        country,
        energy,
        style,
        languages,
        tierOneCount,
        imageNotes,
        mood,
      });

      setStatus("Checking YouTube audio sources...");
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
      setStatus(songData.demo ? "Demo song list shown because a model key is missing." : "Song list ready.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="TravelTunes song picker">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <Music2 size={22} />
            </span>
            <div>
              <h1>TravelTunes</h1>
              <p>Photo mood to country-aware songs.</p>
            </div>
          </div>
          <button className="icon-button" type="button" onClick={() => window.location.reload()} aria-label="Reset">
            <RotateCcw size={19} />
          </button>
        </header>

        <section className="surface photo-surface">
          <SectionHeading icon={<Camera size={18} />} label="Photos" meta={`${photos.length}/${MAX_PHOTOS}`} />
          <PhotoGallery
            photos={photos}
            maxPhotos={MAX_PHOTOS}
            onChange={handlePhotos}
            onRemove={removePhoto}
            onClear={clearPhotos}
          />
        </section>

        <section className="surface">
          <SectionHeading
            icon={<MapPin size={18} />}
            label="Country"
            meta={detectedCountry ? "Detected" : "Select"}
          />
          <CountryPicker value={country} onChange={setCountry} />
        </section>

        <section className="surface notes-surface">
          <SectionHeading icon={<MessageSquareText size={18} />} label="Image notes" meta="Optional" />
          <input
            value={imageNotes}
            onChange={(event) => setImageNotes(event.target.value)}
            maxLength={180}
            placeholder="Beach sunset, train ride, friends, calm morning..."
            aria-label="Optional image notes for the AI"
          />
        </section>

        <section className="surface controls-surface">
          <PremiumSlider
            icon={<Sparkles size={18} />}
            label="Energy"
            left="Calm"
            right="High"
            value={energy}
            onChange={setEnergy}
          />
          <PremiumSlider
            icon={<WandSparkles size={18} />}
            label="Style"
            left="Traditional"
            right="Modern"
            value={style}
            onChange={setStyle}
          />
        </section>

        <section className="surface">
          <SectionHeading icon={<Globe2 size={18} />} label="Languages" meta={`${tierOneCount} tier-1`} />
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
            className="tier-range"
            type="range"
            min="2"
            max="8"
            value={tierOneCount}
            onChange={(event) => setTierOneCount(Number(event.target.value))}
          />
        </section>

        <section className="surface model-surface">
          <SectionHeading icon={<BrainCircuit size={18} />} label="Model" />
          <div className="segment" role="tablist" aria-label="Vision model">
            <button className={model === "qwen" ? "active" : ""} type="button" onClick={() => setModel("qwen")}>
              <Bot size={18} />
              Qwen
            </button>
            <button className={model === "gemini" ? "active" : ""} type="button" onClick={() => setModel("gemini")}>
              <Sparkles size={18} />
              Gemini
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
        </section>

        <section className="songs" aria-label="Song results">
          <div className="song-list">
            {songs.map((song, index) => {
              const songKey = `${song.title}-${song.artist}-${index}`;
              return (
                <SongRow
                  song={song}
                  songKey={songKey}
                  key={songKey}
                  activeSongKey={activeSongKey}
                  onActiveSongChange={setActiveSongKey}
                />
              );
            })}
          </div>
        </section>

        <button className="primary-action" type="button" onClick={findSongs} disabled={!canRun || busy === "songs"}>
          {busy === "songs" ? <Loader2 className="spin" size={19} /> : <Music2 size={19} />}
          Find songs
        </button>

        {status ? <p className="status">{status}</p> : null}
      </section>
    </main>
  );
}

function SectionHeading({ icon, label, meta }) {
  return (
    <div className="section-heading">
      <span>
        {icon}
        {label}
      </span>
      {meta ? <small>{meta}</small> : null}
    </div>
  );
}

function PhotoGallery({ photos, maxPhotos, onChange, onRemove, onClear }) {
  const remaining = Math.max(0, maxPhotos - photos.length);
  const layoutClass = photos.length ? `count-${photos.length}` : "empty";

  return (
    <>
      <div className="photo-actions">
        {remaining ? (
          <label className={photos.length ? "upload-target compact" : "upload-target"}>
            <input type="file" accept="image/*" multiple onChange={onChange} />
            <ImagePlus size={21} />
            <span>{photos.length ? `Add ${remaining} more` : `Add up to ${maxPhotos} photos`}</span>
          </label>
        ) : null}
        {photos.length ? (
          <button className="clear-photos" type="button" onClick={onClear}>
            <X size={16} />
            Clear
          </button>
        ) : null}
      </div>

      {photos.length ? (
        <div className={`photo-grid ${layoutClass}`}>
          {photos.map((photo, index) => (
            <figure
              className="photo-tile"
              key={photo.id}
              style={{
                "--photo-bg": `url("${photo.previewUrl}")`,
                "--photo-aspect": `${photo.width || 4} / ${photo.height || 3}`,
              }}
            >
              <img src={photo.previewUrl} alt={`Uploaded travel ${index + 1}`} />
              <button className="remove-photo" type="button" onClick={() => onRemove(photo.id)} aria-label={`Remove photo ${index + 1}`}>
                <X size={15} />
              </button>
            </figure>
          ))}
        </div>
      ) : null}
    </>
  );
}

function CountryPicker({ value, onChange }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const pool = normalized
      ? COUNTRY_OPTIONS.filter((country) => country.name.toLowerCase().includes(normalized))
      : COUNTRY_OPTIONS;
    return pool.slice(0, 12);
  }, [query]);

  function selectCountry(name) {
    onChange(name);
    setQuery(name);
    setOpen(false);
  }

  return (
    <div className="country-picker">
      <div className="country-input-shell">
        <span className="country-flag">{flagForCountry(value)}</span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() =>
            window.setTimeout(() => {
              setOpen(false);
              if (!COUNTRY_OPTIONS.some((country) => country.name === query)) setQuery(value);
            }, 120)
          }
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !filtered[0]) return;
            event.preventDefault();
            selectCountry(filtered[0].name);
          }}
          placeholder="Search countries"
          aria-label="Search countries"
        />
        <Search size={18} />
      </div>
      {open ? (
        <div className="country-menu">
          {filtered.map((country) => (
            <button type="button" key={country.code} onMouseDown={() => selectCountry(country.name)}>
              <span>{country.flag}</span>
              <strong>{country.name}</strong>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PremiumSlider({ icon, label, left, right, value, onChange }) {
  return (
    <label className="slider-block">
      <span className="slider-title">
        <span>
          {icon}
          {label}
        </span>
        <strong>{value}</strong>
      </span>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ "--value": `${value}%` }}
      />
      <span className="slider-labels">
        <small>{left}</small>
        <small>{right}</small>
      </span>
    </label>
  );
}

function SongRow({ song, songKey, activeSongKey, onActiveSongChange }) {
  const playerRef = useRef(null);
  const playerNodeId = useMemo(() => `yt-${songKey.replace(/[^a-z0-9]+/gi, "-")}`, [songKey]);
  const isActive = activeSongKey === songKey;
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(180);
  const [currentTime, setCurrentTime] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!song.videoId) return undefined;
    let cancelled = false;
    loadYoutubeApi().then((YT) => {
      if (cancelled || playerRef.current) return;
      playerRef.current = new YT.Player(playerNodeId, {
        width: "1",
        height: "1",
        videoId: song.videoId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: (event) => {
            setIsReady(true);
            const nextDuration = event.target.getDuration();
            if (Number.isFinite(nextDuration) && nextDuration > 0) setDuration(nextDuration);
          },
          onStateChange: (event) => {
            const playing = event.data === YT.PlayerState.PLAYING;
            setIsPlaying(playing);
            if (playing) onActiveSongChange(songKey);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [onActiveSongChange, playerNodeId, song.videoId, songKey]);

  useEffect(() => {
    if (activeSongKey === songKey || !playerRef.current?.pauseVideo) return;
    playerRef.current.pauseVideo();
    setIsPlaying(false);
  }, [activeSongKey, songKey]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime) return;
      const nextTime = player.getCurrentTime();
      const nextDuration = player.getDuration?.();
      setCurrentTime(Number.isFinite(nextTime) ? nextTime : 0);
      if (Number.isFinite(nextDuration) && nextDuration > 0) setDuration(nextDuration);
    }, 500);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  function togglePlay() {
    if (!song.videoId) {
      onActiveSongChange(songKey);
      return;
    }
    const player = playerRef.current;
    onActiveSongChange(songKey);
    if (!player || !isReady) return;
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }

  function seek(event) {
    const nextTime = Number(event.target.value);
    setCurrentTime(nextTime);
    playerRef.current?.seekTo?.(nextTime, true);
  }

  async function copySong() {
    await navigator.clipboard.writeText(`${song.title} - ${song.artist}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  const progress = duration ? Math.min(100, (currentTime / duration) * 100) : 0;
  const languages = String(song.language || "Music")
    .split(/[,+/]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);

  return (
    <article className={`song-row ${isActive ? "active" : ""} ${isPlaying ? "playing" : ""}`}>
      <button
        className="play-button"
        type="button"
        onClick={togglePlay}
        aria-label={`${isPlaying ? "Pause" : "Play"} ${song.title}`}
        title={song.videoId ? "Play in app" : "Audio source not available"}
      >
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>
      <div className="song-main">
        <div className="song-line">
          <div className="song-text">
            <h3>{song.title}</h3>
            <p>{song.artist}</p>
          </div>
          <div className="song-tags">
            {languages.map((language) => (
              <span className="song-tag" key={language}>{language}</span>
            ))}
          </div>
          <button className="song-copy" type="button" onClick={copySong} aria-label={`Copy ${song.title}`}>
            {copied ? <Check size={17} /> : <Copy size={17} />}
          </button>
        </div>
        <div className="timeline-row">
          <span>{formatTime(currentTime)}</span>
          <input
            aria-label={`Seek ${song.title}`}
            type="range"
            min="0"
            max={Math.max(1, Math.floor(duration))}
            value={Math.min(Math.floor(currentTime), Math.floor(duration))}
            onChange={seek}
            style={{ "--value": `${progress}%` }}
            disabled={!song.videoId || !isReady}
          />
          <span>{formatTime(duration)}</span>
        </div>
        {isActive && !song.videoId ? <p className="audio-note">Audio source not available yet.</p> : null}
      </div>
      {song.videoId ? <div className="youtube-audio" id={playerNodeId} aria-hidden="true" /> : null}
    </article>
  );
}

async function detectCountry(photos) {
  for (const photo of photos) {
    const gps = await getGpsFromPhoto(photo.file);
    if (!gps) continue;
    try {
      const place = await reverseGeocodeCountry(gps);
      if (place) return place;
    } catch {
      return "";
    }
  }
  return "";
}

function readPhotoPreview(file) {
  return new Promise((resolve) => {
    const previewUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({
        id: createPhotoId(file),
        file,
        name: file.name,
        previewUrl,
        width: image.naturalWidth || 4,
        height: image.naturalHeight || 3,
      });
    };
    image.onerror = () => {
      resolve({
        id: createPhotoId(file),
        file,
        name: file.name,
        previewUrl,
        width: 4,
        height: 3,
      });
    };
    image.src = previewUrl;
  });
}

function createPhotoId(file) {
  const randomId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${file.name}-${file.lastModified}-${file.size}-${randomId}`;
}

function formatTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

let youtubeApiPromise;

function loadYoutubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

export default App;
