import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Popup, Polygon, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Papa from 'papaparse';
import ReactDice from 'react-dice-complete';
import './DiceStyles.css';

interface LocationData {
  name: string;
  coordinates: [number, number][];
  description?: string;
  type: string;
  prefecture?: string;
  center?: [number, number];
  areas?: string[];
  polygon?: [number, number][][];
  area1?: string;
  area2?: string;
  area3?: string;
}

// ズームレベルの制御コンポーネント
const ZoomController: React.FC<{
  step: number;
  center?: [number, number];
}> = ({ step, center }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      const zoomLevels = [5, 7, 9]; // 段階ごとのズームレベル
      map.flyTo(center, zoomLevels[step - 1] || 5, {
        duration: 2
      });
    }
  }, [step, center, map]);

  return null;
};

// ステッパーコンポーネント
const Stepper: React.FC<{ currentStep: number }> = ({ currentStep }) => {
  return (
    <div style={{
      position: 'absolute',
      top: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      padding: '10px 20px',
      borderRadius: '20px',
      display: 'flex',
      gap: '10px',
      alignItems: 'center'
    }}>
      {[1, 2, 3].map((step) => (
        <React.Fragment key={step}>
          <div style={{
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: step <= currentStep ? '#00a8ff' : 'rgba(255,255,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold'
          }}>
            {step}
          </div>
          {step < 3 && (
            <div style={{
              width: '20px',
              height: '2px',
              background: step < currentStep ? '#00a8ff' : 'rgba(255,255,255,0.3)'
            }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// サイコロオーバーレイコンポーネント
const DiceOverlay: React.FC<{
  isVisible: boolean;
  onRollComplete: (value: number) => void;
  setRollStartTime: (time: number) => void;
  isRolling: boolean;
  rollStartTime: number;
}> = ({ isVisible, onRollComplete, setRollStartTime, isRolling, rollStartTime }) => {
  const diceRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [diceSize, setDiceSize] = useState<number>(Math.min(window.innerWidth * 0.15, 120));
  useEffect(() => {
    const handleResize = () => setDiceSize(Math.min(window.innerWidth * 0.15, 120));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setIsReady(false);
    }
  }, [isVisible]);

  // 表示メッセージを3段階で切り替え
  const message = isReady
    ? 'サイコロを振ってください！'
    : isRolling
      ? 'サイコロを振っています…'
      : rollStartTime > 0
        ? 'サイコロが振られました！'
        : 'サイコロを準備しています';

  if (!isVisible) return null;

  const handleRollClick = () => {
    if (isReady && diceRef.current) {
      setIsReady(false);
      setRollStartTime(Date.now());
      diceRef.current.rollAll();
    }
  };

  const wrappedOnRoll = (value: number) => {
    onRollComplete(value);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100dvw',
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'rgba(0,0,0,0.8)',
      zIndex: 2000,
      gap: '20px'
    }}>
      <div style={{
        color: 'white',
        fontSize: '24px',
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: '20px'
      }}>
        {message}
      </div>
      <div 
        style={{
          width: '15vw',
          maxWidth: '200px',
          height: '15vw',
          maxHeight: '200px',
          background: 'transparent',
          padding: '10px',
          borderRadius: '10px',
          boxShadow: '0 0 20px rgba(0,168,255,0.5)',
          cursor: isReady ? 'pointer' : 'default',
          transition: 'all 0.3s ease',
          opacity: isReady ? 1 : 0.7,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
        onClick={handleRollClick}
      >
        <ReactDice
          numDice={1}
          rollDone={wrappedOnRoll}
          ref={diceRef}
          rollTime={1}
          disableIndividual={true}
          margin={10}
          outline={true}
          outlineColor="#00a8ff"
          faceColor="#ffffff"
          dotColor="#00a8ff"
          dieSize={diceSize}
        />
      </div>
    </div>
  );
};

const MapScreen: React.FC = () => {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<LocationData[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [diceResults, setDiceResults] = useState<number[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([36.5, 138.0]);
  const [isDiceVisible, setIsDiceVisible] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [rollStartTime, setRollStartTime] = useState<number>(0);
  const [showCopyToast, setShowCopyToast] = useState(false);

  const parseCenterCoord = (centerCoord: string): [number, number] | undefined => {
    if (!centerCoord) return undefined;
    const match = centerCoord.match(/POINT \(([\d.]+) ([\d.]+)\)/);
    if (!match) return undefined;
    const [lon, lat] = match.slice(1).map(Number);
    return [lat, lon];
  };

  const parseCoordinates = (coordsStr: string): [number, number][] => {
    // 座標文字列を整理
    const cleanStr = coordsStr.trim().replace(/\s+/g, ' ');
    
    // カンマで分割し、各座標ペアを処理
    return cleanStr.split(',').map(coord => {
      // 座標ペアをスペースで分割
      const parts = coord.trim().split(' ');
      if (parts.length !== 2) return null;
      
      const [lon, lat] = parts.map(Number);
      if (isNaN(lat) || isNaN(lon)) return null;
      
      // Leafletは[lat, lon]の順序を期待する
      return [lat, lon] as [number, number];
    }).filter((coord): coord is [number, number] => coord !== null);
  };

  const parsePolygon = (geometry: string): [number, number][][] | undefined => {
    if (!geometry) return undefined;

    // MultiPolygonの処理
    if (geometry.startsWith('MULTIPOLYGON')) {
      // 最も外側の括弧の中身を取得
      const match = geometry.match(/MULTIPOLYGON \(\((.*)\)\)/);
      if (!match) return undefined;
      
      const content = match[1];
      
      // 個々のポリゴンを分割
      const polygons: [number, number][][] = [];
      let currentPolygon = '';
      let depth = 0;
      
      for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '(') {
          depth++;
        } else if (char === ')') {
          depth--;
          if (depth === 0 && currentPolygon) {
            const coords = parseCoordinates(currentPolygon);
            if (coords.length > 0) {
              polygons.push(coords);
            }
            currentPolygon = '';
          }
        } else if (depth > 0) {
          currentPolygon += char;
        }
      }
      
      if (polygons.length === 0) return undefined;
      return polygons;
    }

    // 通常のPolygonの処理
    const match = geometry.match(/POLYGON \(\((.*?)\)\)/);
    if (!match) return undefined;
    const coordsStr = match[1];
    const coords = parseCoordinates(coordsStr);
    
    if (coords.length === 0) return undefined;
    return [coords];
  };

  // サイコロを振る関数
  const rollDice = () => {
    if (currentStep >= 3 || isRolling) return;
    // alert('rollDiceが呼ばれた！');
    setIsRolling(true);
    setIsDiceVisible(true);
  };

  // サイコロの結果を処理する関数
  const handleDiceRollComplete = (value: number) => {
    if (!isRolling || rollStartTime === 0) return;
    if (typeof value !== 'number' || value < 1 || value > 6) return;
    // alert(`handleDiceRollCompleteが呼ばれた！ 値: ${value}`);
    
    const newResults = [...diceResults, value];
    setDiceResults(newResults);
  
    const elapsed = Date.now() - rollStartTime;
    const remaining = Math.max(0, 2000 - elapsed);
  
    setTimeout(() => {
      setCurrentStep(prev => prev + 1);
      setIsDiceVisible(false);
      setIsRolling(false);
      filterLocations(newResults);
      setRollStartTime(0);
    }, remaining);
  };

  // 結果をコピーする関数
  const copyResults = () => {
    const names = filteredLocations.map(loc => loc.name).join(', ');
    navigator.clipboard.writeText(names);
    setShowCopyToast(true);
    setTimeout(() => setShowCopyToast(false), 2000);
  };

  // ロケーションのフィルタリング
  const filterLocations = (results: number[]) => {
    let filtered = [...locations];
    
    results.forEach((result, index) => {
      const areaKey = `area${index + 1}` as keyof LocationData;
      filtered = filtered.filter(loc => {
        const areaValue = loc[areaKey];
        return areaValue && Number(areaValue) === result;
      });
    });

    setFilteredLocations(filtered);

    // フィルタリングされた結果の中心を計算
    if (filtered.length > 0 && filtered[0].center) {
      setMapCenter(filtered[0].center);
    }
  };

  useEffect(() => {
    fetch('/gdf.csv')
      .then(response => response.text())
      .then(csv => {
        Papa.parse(csv, {
          header: true,
          complete: (results) => {
            const data = results.data.map((row: any) => {
              const center = parseCenterCoord(row.Center_Coord);
              const polygon = parsePolygon(row.geometry);
              return {
                name: row.region_name || '',
                coordinates: center ? [center] : [],
                description: row.N03_001 || '',
                type: 'point',
                prefecture: row.N03_001,
                center,
                areas: row.prefectures ? row.prefectures.split('・') : [],
                polygon,
                area1: row.area1,
                area2: row.area2,
                area3: row.area3
              };
            }).filter(loc => loc.polygon && loc.polygon.length > 0);
            setLocations(data);
            setFilteredLocations(data);
          },
          error: () => {
          }
        });
      })
      .catch(() => {
      });
  }, []);

  const renderLocation = (location: LocationData, index: number) => {
    const elements: React.ReactElement[] = [];

    if (location.polygon && location.polygon.length > 0) {
      location.polygon.forEach((polygonCoords, polyIndex) => {
        elements.push(
          <Polygon
            key={`polygon-${index}-${polyIndex}`}
            positions={polygonCoords}
            pathOptions={{
              color: '#00a8ff',
              fillColor: '#00a8ff',
              fillOpacity: 0.3,
              weight: 2
            }}
          >
            <Popup>
              <h3>{location.name}</h3>
            </Popup>
          </Polygon>
        );
      });
    }

    return elements;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100dvh',
      width: '100dvw',
      zIndex: 1
    }}>
      <Stepper currentStep={currentStep} />
      
      <DiceOverlay
        isVisible={isDiceVisible}
        onRollComplete={handleDiceRollComplete}
        setRollStartTime={setRollStartTime}
        isRolling={isRolling}
        rollStartTime={rollStartTime}
      />

      {currentStep < 3 ? (
        <button
          onClick={rollDice}
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            padding: '10px 20px',
            fontSize: '18px',
            background: '#00a8ff',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer'
          }}
          disabled={isRolling}
        >
          {isRolling ? 'サイコロを振っています...' : 'サイコロを振る！'}
        </button>
      ) : (
        <button
          onClick={copyResults}
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            padding: '10px 20px',
            fontSize: '18px',
            background: '#00a8ff',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer'
          }}
        >
          結果をコピー
        </button>
      )}

      <MapContainer
        center={[36.5, 138.0]}
        zoom={5}
        style={{ height: '100%', width: '100%', background: '#242424' }}
        scrollWheelZoom={true}
        minZoom={4}
        maxZoom={18}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>, &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
        />
        <ZoomController step={currentStep} center={mapCenter} />
        {filteredLocations.map((location, index) => renderLocation(location, index))}
      </MapContainer>
      {showCopyToast && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '8px',
          zIndex: 1001
        }}>
          クリップボードに保存されました
        </div>
      )}
    </div>
  );
};

export default MapScreen; 