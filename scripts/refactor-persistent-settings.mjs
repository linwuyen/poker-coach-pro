import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appPath = path.join(root, 'src', 'App.tsx');
const write = process.argv.includes('--write');
let source = fs.readFileSync(appPath, 'utf8');

const replacements = [
  {
    name: 'settings import',
    before: "import { getWeakScenarioIds, summarizeBy } from './utils/analytics';\n",
    after: "import { getWeakScenarioIds, summarizeBy } from './utils/analytics';\nimport {\n  aiModeCodec,\n  booleanCodec,\n  sessionSizeCodec,\n  stringArrayCodec,\n  tableSizeCodec,\n  usePersistentState,\n  volumeCodec,\n  type SessionSize,\n} from './features/settings/persistence';\n",
  },
  {
    name: 'shuffle setting',
    before: `  // Question Pool customizer settings (Shuffle & Deduplication)\n  const [shuffleEnabled, setShuffleEnabled] = useState(() => {\n    try {\n      return localStorage.getItem('poker_shuffle_enabled') !== 'false'; // default to true\n    } catch {\n      return true;\n    }\n  });\n`,
    after: `  // Question Pool customizer settings (Shuffle & Deduplication)\n  const [shuffleEnabled, setShuffleEnabled] = usePersistentState(\n    'poker_shuffle_enabled',\n    true,\n    booleanCodec,\n  );\n`,
  },
  {
    name: 'AI mode setting',
    before: `  const [aiMode, setAiMode] = useState<'online' | 'offline'>(() => {\n    try {\n      return (localStorage.getItem('poker_ai_mode') as 'online' | 'offline') || 'offline'; // default to offline for fast loading as requested!\n    } catch {\n      return 'offline';\n    }\n  });\n`,
    after: `  const [aiMode, setAiMode] = usePersistentState(\n    'poker_ai_mode',\n    'offline',\n    aiModeCodec,\n  );\n`,
  },
  {
    name: 'table size setting',
    before: `  // Table size state (defaulting to 9max based on user preferences)\n  const [tableSize, setTableSize] = useState<'6max' | '9max'>(() => {\n    try {\n      return (localStorage.getItem('poker_table_size') as '6max' | '9max') || '9max';\n    } catch {\n      return '9max';\n    }\n  });\n`,
    after: `  // Table size state (defaulting to 9max based on user preferences)\n  const [tableSize, setTableSize] = usePersistentState(\n    'poker_table_size',\n    '9max',\n    tableSizeCodec,\n  );\n`,
  },
  {
    name: 'session size setting',
    before: `  const [sessionSize, setSessionSize] = useState<10 | 20 | 'all'>(() => {\n    const saved = localStorage.getItem('poker_session_size');\n    return saved === '10' ? 10 : saved === 'all' ? 'all' : 20;\n  });\n`,
    after: `  const [sessionSize, setSessionSize] = usePersistentState<SessionSize>(\n    'poker_session_size',\n    20,\n    sessionSizeCodec,\n  );\n`,
  },
  {
    name: 'muted setting',
    before: `  // Sound Muted state persistence\n  const [isMuted, setIsMuted] = useState(() => {\n    try {\n      return localStorage.getItem('poker_training_muted') === 'true';\n    } catch {\n      return false;\n    }\n  });\n`,
    after: `  // Sound Muted state persistence\n  const [isMuted, setIsMuted] = usePersistentState(\n    'poker_training_muted',\n    false,\n    booleanCodec,\n  );\n`,
  },
  {
    name: 'volume setting',
    before: `  const [pokerVolume, setPokerVolume] = useState(() => {\n    try {\n      const vol = localStorage.getItem('poker_training_volume');\n      return vol ? Number(vol) : 0.5;\n    } catch {\n      return 0.5;\n    }\n  });\n`,
    after: `  const [pokerVolume, setPokerVolume] = usePersistentState(\n    'poker_training_volume',\n    0.5,\n    volumeCodec,\n  );\n`,
  },
  {
    name: 'volume handler',
    before: `  const handleVolumeChange = (v: number) => {\n    setPokerVolume(v);\n    try {\n      localStorage.setItem('poker_training_volume', String(v));\n    } catch (e) {\n      console.error(e);\n    }\n  };\n`,
    after: `  const handleVolumeChange = (value: number) => {\n    setPokerVolume(value);\n  };\n`,
  },
  {
    name: 'starred setting',
    before: `  // Starred Bookmarks scenario IDs persistence\n  const [starredIds, setStarredIds] = useState<string[]>(() => {\n    try {\n      const saved = localStorage.getItem('poker_starred_ids');\n      return saved ? JSON.parse(saved) : [];\n    } catch {\n      return [];\n    }\n  });\n`,
    after: `  // Starred Bookmarks scenario IDs persistence\n  const [starredIds, setStarredIds] = usePersistentState(\n    'poker_starred_ids',\n    [] as string[],\n    stringArrayCodec,\n  );\n`,
  },
  {
    name: 'mute handler',
    before: `  const toggleMute = () => {\n    setIsMuted(prev => {\n      const newVal = !prev;\n      localStorage.setItem('poker_training_muted', String(newVal));\n      return newVal;\n    });\n  };\n`,
    after: `  const toggleMute = () => {\n    setIsMuted(previous => !previous);\n  };\n`,
  },
  {
    name: 'star handler persistence',
    before: `      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];\n      localStorage.setItem('poker_starred_ids', JSON.stringify(next));\n      playPokerSound('click', isMuted);\n`,
    after: `      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];\n      playPokerSound('click', isMuted);\n`,
  },
];

let changed = false;
for (const replacement of replacements) {
  if (source.includes(replacement.after)) continue;
  if (!source.includes(replacement.before)) {
    throw new Error(`Unable to locate ${replacement.name}; App.tsx changed unexpectedly`);
  }
  source = source.replace(replacement.before, replacement.after);
  changed = true;
}

if (!changed) {
  console.log('PASS: persistent settings refactor already applied');
  process.exit(0);
}

if (!write) {
  console.error('App.tsx requires persistent settings refactor. Run with --write.');
  process.exit(1);
}

fs.writeFileSync(appPath, source);
console.log('PASS: persistent settings refactor applied');
