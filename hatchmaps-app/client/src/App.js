import * as React from 'react';
import { useState, useEffect } from "react";
import Map, {Marker, Popup} from 'react-map-gl';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import axios from 'axios';
import { sites } from './data/Data';
import celcToFar from './functions/functions.js';
import "./css/custom.css";
import "./css/bootstrap.min.css";

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

  useEffect(() => {
    axios.get('http://localhost:3000/temps')
      .then(response => {
        if (response.data && response.data.length > 0) {
          setTemps(response.data);
          console.log("Temps properly fetched from backend:", response.data);
          setDataFetchError(false);
        } else {
          console.log("Temps returned empty");
          setDataFetchError(true);
        }
      })
      .catch(error => {
        console.error('Error fetching temps:', error);
        setDataFetchError(true);
      });
  }, []);
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
      // Use temperature data from backend
      processedSites = temps.map(temp => {
        const matchingSite = sites[Number(temp.siteCode)];
        if (matchingSite) {
          const newBugsLikelyHatching = [];
          // Use the month from the temperature log
          const monthNumber = temp.time.substring(5, 7);;
          Object.entries(matchingSite.bodyOfWater.bugs).forEach(([bugName, bugEntry]) => {
            const bug = bugEntry.bug;
            if (bug.hatchTemp && bug.hatchTemp.length === 2 && bugEntry.time[0].includes(monthNumber)) {
              const bottomTemp = bug.hatchTemp[0] - 2;
              const topTemp = bug.hatchTemp[1];
              const farTemp = celcToFar(temp.value);
              if (bottomTemp <= farTemp && farTemp <= topTemp) {
                newBugsLikelyHatching.push(bug);
              }
            }
          });
          return {
            ...matchingSite,
            temp: celcToFar(temp.value),
            recentLogTime: temp.time,
            bugsHatching: newBugsLikelyHatching,
          };
        }
        return null;
      }).filter(site => site !== null);
    }

    setUpdatedSites(processedSites);
  }, [temps, dataFetchError]);

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
      </div>
    </div>
  );
}

export default App;