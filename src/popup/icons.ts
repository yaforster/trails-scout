import {
  Circle,
  CircleAlert,
  CircleCheck,
  CloudCheck,
  createIcons,
  Crosshair,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  LoaderCircle,
  LogIn,
  Moon,
  RefreshCw,
  Send,
  Settings,
  Trash2,
  Sun,
} from 'lucide';

export function renderIcons(): void {
  createIcons({
    icons: {
      Circle,
      CircleAlert,
      CircleCheck,
      CloudCheck,
      Crosshair,
      Eye,
      EyeOff,
      KeyRound,
      Layers,
      LoaderCircle,
      LogIn,
      Moon,
      RefreshCw,
      Send,
      Settings,
      Sun,
      Trash2,
    },
  });
}
