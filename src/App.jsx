import { SiDeepseek, SiGooglegemini, SiQwen } from "@icons-pack/react-simple-icons";
import {
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
import { codeForCountry, COUNTRY_OPTIONS } from "./data/countries";
import { postJson, readFileAsVisionPayload } from "./lib/api";
import { getGpsFromPhoto, reverseGeocodeCountry } from "./lib/location";

export function FlagIcon({ code, className = "" }) {
  if (!code) return null;
  return (
    <img
      src={`https://flagcdn.com/w40/${String(code).toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/w80/${String(code).toLowerCase()}.png 2x`}
      alt=""
      aria-hidden="true"
      width={20}
      height={15}
      loading="lazy"
      className={`flag-img ${className}`.trim()}
    />
  );
}

const MAX_PHOTOS = 4;
const TOTAL_SONGS = 8;
const MAX_COUNTRIES = 4;

const MODEL_OPTIONS = [
  {
    id: "gemini",
    label: "Gemini",
    Icon: SiGooglegemini,
  },
  {
    id: "qwen",
    label: "Qwen",
    Icon: SiQwen,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    Icon: SiDeepseek,
  },
];

const ENERGY_OPTIONS = [
  { label: "Calm", value: 15 },
  { label: "Easy", value: 40 },
  { label: "Lively", value: 65 },
  { label: "High", value: 90 },
];

const STYLE_OPTIONS = [
  { label: "Traditional", value: 20 },
  { label: "Mixed", value: 50 },
  { label: "Modern", value: 80 },
];

function distributeEvenly(items) {
  const n = items.length;
  if (n === 0) return [];
  const base = Math.floor(TOTAL_SONGS / n);
  const remainder = TOTAL_SONGS % n;
  return items.map((item, idx) => ({
    ...item,
    count: base + (idx < remainder ? 1 : 0),
  }));
}

function incrementCountryCount(list, targetIdx) {
  let maxCount = 1;
  let donorIdx = -1;
  for (let i = 0; i < list.length; i += 1) {
    if (i === targetIdx) continue;
    if (list[i].count > 1 && list[i].count >= maxCount) {
      maxCount = list[i].count;
      donorIdx = i;
    }
  }
  if (donorIdx === -1) return list;
  return list.map((item, i) => {
    if (i === targetIdx) return { ...item, count: item.count + 1 };
    if (i === donorIdx) return { ...item, count: item.count - 1 };
    return item;
  });
}

function decrementCountryCount(list, targetIdx) {
  if (list[targetIdx].count <= 1) return list;
  let maxCount = -1;
  let recipientIdx = -1;
  for (let i = 0; i < list.length; i += 1) {
    if (i === targetIdx) continue;
    if (list[i].count >= maxCount) {
      maxCount = list[i].count;
      recipientIdx = i;
    }
  }
  if (recipientIdx === -1) return list;
  return list.map((item, i) => {
    if (i === targetIdx) return { ...item, count: item.count - 1 };
    if (i === recipientIdx) return { ...item, count: item.count + 1 };
    return item;
  });
}

function App() {
  const [photos, setPhotos] = useState([]);
  const [country, setCountry] = useState("Sri Lanka");
  const [detectedCountry, setDetectedCountry] = useState("");
  const [musicCountries, setMusicCountries] = useState(() => [
    { name: "Sri Lanka", code: codeForCountry("Sri Lanka") || "LK", count: 8 },
  ]);
  const [energy, setEnergy] = useState(40);
  const [detectedEnergy, setDetectedEnergy] = useState(null);
  const [style, setStyle] = useState(50);
  const [model, setModel] = useState("gemini");
  const [resolvedModels, setResolvedModels] = useState({ vision: "", songs: "" });
  const [imageNotes, setImageNotes] = useState("");
  const [mood, setMood] = useState(null);
  const [songs, setSongs] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState("");
  const [activeSongKey, setActiveSongKey] = useState("");

  const canRun = photos.length > 0 && country;
  const selectedModelOption = MODEL_OPTIONS.find((m) => m.id === model) || MODEL_OPTIONS[0];
  const modelLabel = selectedModelOption.label;

  const photosRef = useRef(photos);
  photosRef.current = photos;

  // Clear obsolete languages key on initial load
  useEffect(() => {
    try {
      localStorage.removeItem("traveltunes_recent_languages");
    } catch {
      // Ignore
    }
  }, []);

  // Unmount-only cleanup so adding photos doesn't revoke existing previews
  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  function handlePhotoCountryChange(newCountry) {
    setCountry(newCountry);
    const code = codeForCountry(newCountry);
    if (newCountry && code) {
      addMusicCountry({ name: newCountry, code });
    }
  }

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
    setDetectedEnergy(null);
    setStatus("");

    const detected = await detectCountry(nextPhotos);
    if (detected) {
      setDetectedCountry(detected);
      setCountry(detected);
      const detectedCode = codeForCountry(detected);
      if (detectedCode) {
        addMusicCountry({ name: detected, code: detectedCode });
      }
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
    setDetectedEnergy(null);
    setStatus("");
  }

  function clearPhotos() {
    setPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      return [];
    });
    setMood(null);
    setDetectedEnergy(null);
    setDetectedCountry("");
    setStatus("");
  }

  function resetAll() {
    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    setPhotos([]);
    setCountry("Sri Lanka");
    setDetectedCountry("");
    setMusicCountries([{ name: "Sri Lanka", code: codeForCountry("Sri Lanka") || "LK", count: 8 }]);
    setEnergy(40);
    setDetectedEnergy(null);
    setStyle(50);
    setModel("gemini");
    setResolvedModels({ vision: "", songs: "" });
    setImageNotes("");
    setMood(null);
    setSongs([]);
    setHasSearched(false);
    setStatus("");
    setBusy("");
    setActiveSongKey("");
  }

  function addMusicCountry(countryObj) {
    if (!countryObj?.name || musicCountries.length >= MAX_COUNTRIES || musicCountries.some((c) => c.name === countryObj.name)) return;
    const next = [...musicCountries, { name: countryObj.name, code: countryObj.code }];
    setMusicCountries(distributeEvenly(next));
  }

  function removeMusicCountry(countryName) {
    const next = musicCountries.filter((c) => c.name !== countryName);
    setMusicCountries(distributeEvenly(next));
  }

  function handleIncrement(targetIdx) {
    setMusicCountries((prev) => incrementCountryCount(prev, targetIdx));
  }

  function handleDecrement(targetIdx) {
    setMusicCountries((prev) => decrementCountryCount(prev, targetIdx));
  }

  function handleSongUpdate(songKey, updates) {
    setSongs((current) =>
      current.map((song) => (song.id === songKey ? { ...song, ...updates } : song)),
    );
  }

  async function findSongs() {
    if (!canRun) return;
    setBusy("songs");
    try {
      let currentMood = mood;
      let resolvedVision = "";
      let runId;
      setStatus(`Reading photo mood with ${modelLabel}...`);
      try {
        const imagePayloads = await Promise.all(photos.map((photo) => readFileAsVisionPayload(photo.file)));
        const visionData = await postJson("/api/vision", {
          model,
          country,
          energy,
          style,
          imageNotes,
          photos: imagePayloads,
        });
        currentMood = visionData.mood;
        setMood(visionData.mood);
        resolvedVision = visionData.resolvedModel || "";
        runId = visionData.runId;
        if (visionData.mood?.energy != null && Number.isFinite(Number(visionData.mood.energy))) {
          setDetectedEnergy(Math.round(Number(visionData.mood.energy)));
        }
      } catch {
        // Mood read is best-effort; keep going with current user settings
      }

      setStatus("Building song list...");
      const songPayload = {
        model,
        country,
        musicCountries: musicCountries.map((c) => ({ name: c.name, count: c.count })),
        energy,
        style,
        imageNotes,
        mood: currentMood,
      };
      if (runId) {
        songPayload.runId = runId;
      }
      const songData = await postJson("/api/songs", songPayload);

      const resolvedSongs = songData.resolvedModel || "";
      setResolvedModels({ vision: resolvedVision, songs: resolvedSongs });

      const rawSongs = songData.songs || [];
      const songsWithIds = rawSongs.map((song, index) => ({
        ...song,
        id: crypto.randomUUID?.() ?? `${Date.now()}-${index}`,
      }));
      setSongs(songsWithIds);
      setHasSearched(true);
      setStatus(songData.demo ? "Demo song list shown because a model key is missing." : "Song list ready.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy("");
    }
  }

  // Summary line directly above Find songs button
  const summaryLine = useMemo(() => {
    if (musicCountries.length === 0) {
      return "8 well-known international songs.";
    }
    if (musicCountries.length === 1) {
      return `8 songs from ${musicCountries[0].name}.`;
    }
    const parts = musicCountries.map((c) => `${c.count} from ${c.name}`);
    return `${parts.join(", ")}.`;
  }, [musicCountries]);

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
          <button className="icon-button" type="button" onClick={resetAll} aria-label="Reset">
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
          <CountryPicker value={country} onChange={handlePhotoCountryChange} />
          <p className="field-caption">Used to read the photo mood and automatically adds to Music from.</p>
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
          <ChoiceRow
            icon={<Sparkles size={18} />}
            label="Energy"
            badge={detectedEnergy != null ? `photo reads ${detectedEnergy}` : null}
            options={ENERGY_OPTIONS}
            value={energy}
            onChange={setEnergy}
          />
          <ChoiceRow
            icon={<WandSparkles size={18} />}
            label="Style"
            options={STYLE_OPTIONS}
            value={style}
            onChange={setStyle}
          />
        </section>

        <section className="surface">
          <SectionHeading
            icon={<Globe2 size={18} />}
            label="Music from"
            meta={musicCountries.length > 0 ? `${musicCountries.length}/${MAX_COUNTRIES}` : null}
          />
          {musicCountries.length === 0 ? (
            <p className="helper-text">No countries selected. Songs will be well-known international picks.</p>
          ) : (
            <>
              <div className="chip-row country-chips-row">
                {musicCountries.map((c, idx) => {
                  const canIncrement = musicCountries.some((other, oIdx) => oIdx !== idx && other.count > 1);
                  const canDecrement = c.count > 1;
                  const showCounts = musicCountries.length > 1;

                  return (
                    <div className="chip country-chip" key={c.name}>
                      <FlagIcon code={c.code} />
                      <span className="country-name">{c.name}</span>
                      {showCounts ? (
                        <div className="country-count-stepper">
                          <span className="country-count">{c.count}</span>
                          <button
                            type="button"
                            className="count-btn"
                            onClick={() => handleDecrement(idx)}
                            disabled={!canDecrement}
                            aria-label={`Decrease songs from ${c.name}`}
                          >
                            −
                          </button>
                          <button
                            type="button"
                            className="count-btn"
                            onClick={() => handleIncrement(idx)}
                            disabled={!canIncrement}
                            aria-label={`Increase songs from ${c.name}`}
                          >
                            +
                          </button>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="chip-remove"
                        onClick={() => removeMusicCountry(c.name)}
                        aria-label={`Remove ${c.name}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
              {musicCountries.length > 1 ? (
                <p className="allocation-status">8 of 8 allocated</p>
              ) : null}
            </>
          )}

          {musicCountries.length < MAX_COUNTRIES ? (
            <div className="add-country-row">
              <CountryPicker
                compact
                placeholder="+ Add country"
                value=""
                onChange={(name) => {
                  const opt = COUNTRY_OPTIONS.find((co) => co.name === name);
                  if (opt) addMusicCountry({ name: opt.name, code: opt.code });
                }}
              />
            </div>
          ) : (
            <p className="field-caption">4 countries maximum</p>
          )}
        </section>

        <section className="surface model-surface">
          <SectionHeading icon={<BrainCircuit size={18} />} label="Model" />
          <div className="segment" role="radiogroup" aria-label="Vision model">
            {MODEL_OPTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={model === id ? "active" : ""}
                type="button"
                role="radio"
                aria-checked={model === id}
                onClick={() => setModel(id)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
          {resolvedModels.vision && resolvedModels.songs ? (
            <p className="field-caption">
              Vision: {resolvedModels.vision} · Songs: {resolvedModels.songs}
            </p>
          ) : null}
          {mood ? <MoodReadout mood={mood} /> : null}
        </section>

        <section className="songs" aria-label="Song results">
          {!hasSearched && songs.length === 0 ? (
            <div className="empty-state">
              <Music2 size={32} strokeWidth={1.5} />
              <p>Add a travel photo and tap Find songs to get recommendations.</p>
            </div>
          ) : (
            <div className="song-list">
              {songs.map((song) => (
                <SongRow
                  song={song}
                  songKey={song.id}
                  key={song.id}
                  activeSongKey={activeSongKey}
                  onActiveSongChange={setActiveSongKey}
                  onSongUpdate={handleSongUpdate}
                />
              ))}
            </div>
          )}
        </section>

        <p className="songs-summary">{summaryLine}</p>

        <button className="primary-action" type="button" onClick={findSongs} disabled={!canRun || busy === "songs"}>
          {busy === "songs" ? <Loader2 className="spin" size={19} /> : <Music2 size={19} />}
          Find songs
        </button>

        {status ? <p className="status">{status}</p> : null}
      </section>
    </main>
  );
}

function ChoiceRow({ icon, label, badge, options, value, onChange }) {
  return (
    <div className="choice-block">
      <span className="slider-title">
        <span>
          {icon}
          {label}
        </span>
        {badge ? <span className="detected-badge">{badge}</span> : null}
      </span>
      <div className="segment" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={value === option.value ? "active" : ""}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MoodReadout({ mood }) {
  const palette = Array.isArray(mood.palette)
    ? mood.palette.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
    : [];

  return (
    <div className="mood-strip">
      <strong>{mood.setting || "Travel scene"}</strong>
      <span>{mood.mood || "balanced, scenic, warm"}</span>
      {mood.notes ? <span className="mood-notes">{mood.notes}</span> : null}
      {palette.length ? (
        <div className="mood-palette">
          {palette.map((color) => (
            <span className="mood-swatch" key={color}>{color}</span>
          ))}
        </div>
      ) : null}
    </div>
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

function CountryPicker({ value, onChange, compact = false, placeholder = "Search countries" }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const pool = normalized
      ? COUNTRY_OPTIONS.filter((country) => country.name.toLowerCase().includes(normalized))
      : COUNTRY_OPTIONS;
    return pool.slice(0, 12);
  }, [query]);

  const selectedCode = useMemo(() => {
    return codeForCountry(value);
  }, [value]);

  function selectCountry(name) {
    onChange(name);
    if (compact) {
      setQuery("");
    } else {
      setQuery(name);
    }
    setOpen(false);
  }

  return (
    <div
      className={`country-picker ${compact ? "compact" : ""}`.trim()}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setOpen(false);
        if (!compact && !COUNTRY_OPTIONS.some((country) => country.name === query)) {
          setQuery(value || "");
        }
      }}
    >
      <div className="country-input-shell">
        <span className="country-flag">
          <FlagIcon code={compact ? "" : selectedCode} />
        </span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !filtered[0]) return;
            event.preventDefault();
            selectCountry(filtered[0].name);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <Search size={18} />
      </div>
      {open ? (
        <div className="country-menu">
          {filtered.map((country) => (
            <button
              type="button"
              key={country.code}
              onClick={() => selectCountry(country.name)}
            >
              <span><FlagIcon code={country.code} /></span>
              <strong>{country.name}</strong>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SongRow({ song, songKey, activeSongKey, onActiveSongChange, onSongUpdate }) {
  const playerRef = useRef(null);
  const playerNodeId = useMemo(() => `yt-${songKey.replace(/[^a-z0-9]+/gi, "-")}`, [songKey]);
  const isActive = activeSongKey === songKey;
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [shouldMountPlayer, setShouldMountPlayer] = useState(false);
  const [duration, setDuration] = useState(180);
  const [currentTime, setCurrentTime] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!song.videoId || !shouldMountPlayer) return undefined;
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
            event.target.playVideo();
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
  }, [onActiveSongChange, playerNodeId, shouldMountPlayer, song.videoId, songKey]);

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

  async function togglePlay() {
    onActiveSongChange(songKey);

    // Look up video on first play if not resolved yet
    if (!song.videoId && !song.audioResolved) {
      setIsLoadingAudio(true);
      try {
        const video = await postJson("/api/youtube", {
          title: song.title,
          artist: song.artist,
          query: `${song.title} ${song.artist}`,
        });
        onSongUpdate(songKey, { ...video, audioResolved: true });
        if (video.videoId) {
          setShouldMountPlayer(true);
        }
      } catch {
        onSongUpdate(songKey, { audioResolved: true });
      } finally {
        setIsLoadingAudio(false);
      }
      return;
    }

    if (!song.videoId) return;

    if (!shouldMountPlayer) {
      setShouldMountPlayer(true);
      return;
    }

    const player = playerRef.current;
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
  const songLanguages = String(song.language || "Music")
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
        disabled={isLoadingAudio}
        aria-label={`${isPlaying ? "Pause" : "Play"} ${song.title}`}
        title={song.videoId ? "Play in app" : (song.audioResolved ? "Audio source not available" : "Play track")}
      >
        {isLoadingAudio ? (
          <Loader2 size={18} className="spin" />
        ) : isPlaying ? (
          <Pause size={20} fill="currentColor" />
        ) : (
          <Play size={18} fill="currentColor" />
        )}
      </button>
      <div className="song-main">
        <div className="song-line">
          <div className="song-text">
            <h3>{song.title}</h3>
            <p>{song.artist}</p>
            {song.reason ? <p className="song-reason">{song.reason}</p> : null}
          </div>
          <div className="song-tags">
            {songLanguages.map((lang) => (
              <span className="song-tag" key={lang}>{lang}</span>
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
        {isActive && song.audioResolved && !song.videoId ? <p className="audio-note">Audio source not available yet.</p> : null}
      </div>
      {song.videoId && shouldMountPlayer ? <div className="youtube-audio" id={playerNodeId} aria-hidden="true" /> : null}
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
      continue;
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
