import { useRoute } from './router';
import Home from './ui/Home';
import NewRoster from './ui/NewRoster';
import RosterEditor from './ui/RosterEditor';
import DataSources from './ui/DataSources';
import Backup from './ui/Backup';
import PlaySetup from './ui/play/PlaySetup';
import GameView from './ui/play/GameView';
import DiceTray from './ui/DiceTray';

export default function App() {
  const route = useRoute();
  let page;
  switch (route[0]) {
    case 'new':
      page = <NewRoster />;
      break;
    case 'roster':
      page = <RosterEditor uid={route[1]} />;
      break;
    case 'data':
      page = <DataSources />;
      break;
    case 'backup':
      page = <Backup />;
      break;
    case 'play':
      page = route[1] ? <GameView uid={route[1]} /> : <PlaySetup />;
      break;
    default:
      page = <Home />;
  }
  return (
    <>
      {page}
      <DiceTray />
    </>
  );
}
