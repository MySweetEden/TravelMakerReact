import MapScreen from './components/MapScreen';
import './App.css';

function App() {
  return (
    <div style={{ 
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden'
    }}>
      <MapScreen />
    </div>
  );
}

export default App;
