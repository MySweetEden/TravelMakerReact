import MapScreen from './components/MapScreen';
import './App.css';

function App() {
  return (
    <div style={{ 
      position: 'relative',
      width: '100dvw',
      height: '100dvh',
      overflow: 'hidden'
    }}>
      <MapScreen />
    </div>
  );
}

export default App;
