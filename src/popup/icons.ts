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
  RefreshCw,
  Send,
  Settings,
  Trash2,
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
      RefreshCw,
      Send,
      Settings,
      Trash2,
    },
  });
}
