import * as React from 'react';
import { useState, useEffect } from "react";
import Map, {Marker, Popup} from 'react-map-gl';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import axios from 'axios';
import { sites } from './data/Data';
import celcToFar from './functions/functions.js';
import "./css/custom.css";
import "./css/bootstrap.min.css";

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const SitePopup = ({ site, onClose }) => {
  const degreeSymbol = '\u00B0';

  return (
    <Popup
      latitude={site.lat}
      longitude={site.long}
      anchor="top"
      onClose={onClose}
      closeOnClick={false}
    >
      <div className="custom-card flex-center">
        <div className="name">
          <label style={{ fontSize: '1.2em' , fontWeight: 'bold' , color: 'white'}} >{site.name}</label>
        </div>
        <div className="name" style={{ paddingTop: '10px' }}>
          <label style={{ fontSize: '1.2em' }}>
            <span style={{ color: 'white',  paddingBottom: '5px', display: 'inline-block'}}>
              {site.recentLogTime ? 'Recent Log Time:' : 'Estimated Hatch Information'}
            </span>
            <br />
            <div className="item" style={{ fontSize: '.9em' }}>
              {site.recentLogTime ? (
                <>
                  {site.recentLogTime}
                  <br />
                  Temperature: {site.temp}{degreeSymbol}F
                </>
              ) : (
                'Based on typical seasonal patterns'
              )}
            </div>
          </label>
        </div>
        <label style={{ marginTop: '20px', fontSize: '1.2em', color: 'white', paddingBottom: '5px', display: 'inline-block'}}>
          Bugs Likely To Hatch:
        </label>
        <div className="item">
          {site.bugsHatching.length > 0 ? (
            site.bugsHatching.map((bug) => (
              <div key={bug.id} style={{ fontSize: '1em' }}>{bug.name}</div>
            ))
          ) : (
            <div>No bugs likely to hatch</div>
          )}
        </div>
      </div>
    </Popup>
  );
};

// Filter Toolbar Component
const FilterToolbar = ({ filters, onFiltersChange, noResults }) => {
  const handleSliderChange = (filterType, value) => {
    onFiltersChange({
      ...filters,
      [filterType]: parseFloat(value)
    });
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      padding: '20px',
      borderRadius: '10px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      minWidth: '300px',
      zIndex: 1000
    }}>
      <h5 style={{ marginBottom: '15px', color: '#333' }}>Filter Sites</h5>
      
      {noResults && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '8px 12px',
          borderRadius: '5px',
          marginBottom: '15px',
          fontSize: '14px'
        }}>
          No sites match current filters
        </div>
      )}
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
          Temperature: {filters.temp}°C
        </label>
        <input
          type="range"
          min="0"
          max="30"
          step="0.5"
          value={filters.temp}
          onChange={(e) => handleSliderChange('temp', e.target.value)}
          style={{ width: '100%' }}
        />
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
          Quality (pH): {filters.quality}
        </label>
        <input
          type="range"
          min="0"
          max="14"
          step="0.1"
          value={filters.quality}
          onChange={(e) => handleSliderChange('quality', e.target.value)}
          style={{ width: '100%' }}
        />
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
          Discharge: {filters.discharge} ft³/s
        </label>
        <input
          type="range"
          min="0"
          max="10000"
          step="10"
          value={filters.discharge}
          onChange={(e) => handleSliderChange('discharge', e.target.value)}
          style={{ width: '100%' }}
        />
      </div>
      
      <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
        Showing sites above these thresholds
      </div>
    </div>
  );
};

function App() {
  const [temps, setTemps] = useState([]);
  const [viewState, setViewState] = useState({
    latitude: 44.6262275,
    longitude: -121.4839433,
    zoom: 6,
  });
  const [updatedSites, setUpdatedSites] = useState([]); 
  const [selectedSite, setSelectedSite] = useState(null);
  const [dataFetchError, setDataFetchError] = useState(false);
  const [filteredData, setFilteredData] = useState([]);
  const [filters, setFilters] = useState({
    temp: 0,
    quality: 0,
    discharge: 0
  });
  const [noResults, setNoResults] = useState(false);

  // Debounced function to fetch filtered data
  const fetchFilteredData = React.useCallback(
    debounce((tempFilter, qualityFilter, dischargeFilter) => {
      const params = new URLSearchParams({
        temp: tempFilter.toString(),
        quality: qualityFilter.toString(),
        discharge: dischargeFilter.toString()
      });
      
      axios.get(`http://localhost:3000/data?${params}`)
        .then(response => {
          if (response.data && response.data.length > 0) {
            setFilteredData(response.data);
            console.log("Filtered data fetched:", response.data);
            setDataFetchError(false);
            setNoResults(false);
          } else {
            console.log("No data matches current filters");
            setFilteredData([]);
            setNoResults(true);
            setDataFetchError(false);
          }
        })
        .catch(error => {
          console.error('Error fetching filtered data:', error);
          setDataFetchError(true);
          setNoResults(false);
        });
    }, 500),
    []
  );

  // Fetch initial data on component mount
  useEffect(() => {
    fetchFilteredData(filters.temp, filters.quality, filters.discharge);
  }, []);

  // Fetch data when filters change
  useEffect(() => {
    fetchFilteredData(filters.temp, filters.quality, filters.discharge);
  }, [filters, fetchFilteredData]);

  useEffect(() => {
    const currentDate = new Date();
    const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, '0');

    let processedSites = [];
    if (dataFetchError) {
      // Fallback: use all sites and the current month to determine bugs
      console.log("using fallback data");
      processedSites = Object.values(sites).map(site => {
        const newBugsLikelyHatching = [];
        const monthNumber = currentMonth;
        Object.entries(site.bodyOfWater.bugs).forEach(([bugName, bugEntry]) => {
          const bug = bugEntry.bug;
          if (bug.hatchTemp && bug.hatchTemp.length === 2 && bugEntry.time[0].includes(monthNumber)) {
            const bottomTemp = bug.hatchTemp[0] - 2;
            const topTemp = bug.hatchTemp[1];
            const farTemp = (bottomTemp + topTemp) / 2; // default midpoint value
            if (bottomTemp <= farTemp && farTemp <= topTemp) {
              newBugsLikelyHatching.push(bug);
            }
          }
        });
        return {
          ...site,
          temp: null,
          recentLogTime: null,
          bugsHatching: newBugsLikelyHatching,
        };
      });
    } else {
      // Use filtered data from backend
      processedSites = filteredData.map(dataPoint => {
        const matchingSite = sites[Number(dataPoint.siteCode)];
        if (matchingSite && dataPoint.Temperature) {
          const newBugsLikelyHatching = [];
          // Use the month from the temperature log
          const monthNumber = dataPoint.temp_time ? dataPoint.temp_time.substring(5, 7) : currentMonth;
          Object.entries(matchingSite.bodyOfWater.bugs).forEach(([bugName, bugEntry]) => {
            const bug = bugEntry.bug;
            if (bug.hatchTemp && bug.hatchTemp.length === 2 && bugEntry.time[0].includes(monthNumber)) {
              const bottomTemp = bug.hatchTemp[0] - 2;
              const topTemp = bug.hatchTemp[1];
              const farTemp = celcToFar(dataPoint.Temperature);
              if (bottomTemp <= farTemp && farTemp <= topTemp) {
                newBugsLikelyHatching.push(bug);
              }
            }
          });
          return {
            ...matchingSite,
            temp: celcToFar(dataPoint.Temperature),
            recentLogTime: dataPoint.temp_time,
            bugsHatching: newBugsLikelyHatching,
          };
        }
        return null;
      }).filter(site => site !== null);
    }

    setUpdatedSites(processedSites);
  }, [filteredData, dataFetchError]);

  return (
    <div className="app-container">
      <div className="container-fluid text-center text-white" style={{ backgroundColor: '#80a981'}}>
        <h1 className="text-center">Hatchmaps</h1>
        <div className="row justify-content-center">
          <div className="col">
            <a href="https://github.com/rdallim2/hatchMaps" target="_blank" rel="noopener noreferrer">
              <button className="btn btn-light">Github</button>
            </a>
          </div>
          <div className="col">
            <a href="https://rdallim2.github.io/RyanDallimore_site/" target="_blank" rel="noopener noreferrer">
              <button className="btn btn-light">Contact</button>
            </a>
          </div>
        </div>
        {dataFetchError && (
          <div className="alert alert-warning" style={{ marginTop: '20px' }}>
            Using estimated data due to server connection issues
          </div>
        )}
      </div>
      <div className="map-container">
        <Map
          mapboxAccessToken={process.env.REACT_APP_MAPBOX}
          {...viewState}
          style={{width: "100%", height: "100%"}}
          mapStyle="mapbox://styles/rdallim2/cm1ibsts6000h01rb81k7efth"
          onMove={(evt) => setViewState(evt.viewState)}
        >
          {updatedSites.map((site) => (
            <React.Fragment key={site.id}>
              <Marker
                latitude={site.lat}
                longitude={site.long}
                anchor="bottom"
                onClick={() => {
                  console.log("Marker clicked:", site.id);
                  setSelectedSite(site);
                }}
              >
                <LocationOnIcon 
                  style={{
                    fontSize: viewState.zoom * 4, 
                    color: "red", 
                    backgroundColor: "transparent"
                  }} 
                />
              </Marker>
              {selectedSite && selectedSite.id === site.id && (
                <SitePopup site={site} onClose={() => setSelectedSite(null)} />
              )}
            </React.Fragment>
          ))}
        </Map>
        <FilterToolbar 
          filters={filters}
          onFiltersChange={setFilters}
          noResults={noResults}
        />
      </div>
    </div>
  );
}

export default App;