// Orignial Functions by Borderline#6033
// Updated by Mo#9991

// classes don't work but prototypes do :sunglasses:
function StintDetails() { // UPDATE isInPitLane() IF YOU UPDATE THIS
	this.startLap = getCurrentLap()
	this.lastPitOdo = 0 // the sessionOdo at the time of last pit
	this.lapCount = 0
	this.startTireWears = getTireWears() // left front, right front, left rear, right rear
	this.endTireWears = [0,0,0,0]
	this.startFuel = getCurrentFuel()
	this.endFuel = 0
	this.startERS = getERS()
	this.endERS = 0
	this.lapTimes = [] // [Date(), lapTime]
	this.startPosition = getPlayerPos() // current position when set (not grid), using 'start' for the 'start' of the stint
	this.endPosition = 0 // current position when set (not final position), using 'end' for 'end' of the stint
}
function SessionDetails() {
	this.startFuel = getCurrentFuel()
	this.sectorTimes = [] // sectorTimes[0] ~ P1 = [endS1, endS2 ...] ~ [Date(), Date() ...]
	this.startPos = getPlayerPos() // grid position
	this.inPitLane = false
}
StintDetails.prototype.toString = function() {
	t = ""
	for (prop in this) {
		t += prop + ": " + this[prop] + "\n"
	}
	return t
}
SessionDetails.prototype.toString = function() {
	t = ""
	for (prop in this) {
		t += prop + ": " + this[prop] + "\n"
	}
	return t
}

stintDetails = new StintDetails()
sessionDetails = new SessionDetails()

const numSectors = 30
const numDrivers = 20

/* --- DELTAS --- */
function updateSector(pos) { // pos is 1-20
	if (pos != getPlayerPos()) {
		updateSector(getPlayerPos())
	}
	pos -= 1
	if ((getSessionOdo() == 0 && getLocalSpeed() == 0) || sessionDetails.sectorTimes.length == 0) { // on race start, reset sectors
		sessionDetails.sectorTimes = []
		for (var i = 0; i < numDrivers; i++) {
			sectors = []
			for (var j = 0; j < numSectors; j++) {
				sectors.push(null)
			}
			sessionDetails.sectorTimes.push(sectors)
		}
	}

	lapDistance = getLapDistance(pos+1)
	sector = parseInt(lapDistance * numSectors)
	now = new Date().getTime()
	if (now - sessionDetails.sectorTimes[pos][sector] > 30*1000 || sessionDetails.sectorTimes[pos][sector] === null) { // only update once per sector
		sessionDetails.sectorTimes[pos][sector] = now
	}
}
function getDeltaToOppPos(oppPos) { // oppPos is 1-20
	playerPos = getPlayerPos()
	playerSector = getSector(playerPos)
	oppSector = getSector(oppPos)
	sector = playerPos > oppPos ? playerSector : oppSector // if player is ahead, then get opp sector b/c they are behind, else get most recent player sector
	return (sessionDetails.sectorTimes[playerPos-1][sector] - sessionDetails.sectorTimes[oppPos-1][sector]) / -1000
}
/* --- END DELTAS --- */


/* --- TIRE WEAR --- */
function getTireWears() { // returning left front, right front, left rear, right rear
	return [
		100-$prop('DataCorePlugin.GameData.NewData.TyreWearFrontLeft'), 
		100-$prop('DataCorePlugin.GameData.NewData.TyreWearFrontRight'), 
		100-$prop('DataCorePlugin.GameData.NewData.TyreWearRearLeft'), 
		100-$prop('DataCorePlugin.GameData.NewData.TyreWearRearRight')
	]
}
function getMaxTireWear() {
	maxTireWear = Math.max.apply(Math, getTireWears())
	return maxTireWear;
}
function getStartTireWears() {
	isStartOfRace()
	return stintDetails.startTireWears
}
function getEndTireWear() {
	remainingDistance = (getTotalLaps() * getTrackLength()) - getSessionOdo()
	maxTireWear = getMaxTireWear()
	stintWearPerDistance = (maxTireWear - Math.max.apply(Math, getStartTireWears())) / getStintOdo()

	return (stintWearPerDistance * remainingDistance) + maxTireWear
}
/* --- END TIRE WEAR --- */


/* --- FUEL --- */
function getCurrentFuel() {
	return $prop('DataCorePlugin.GameData.NewData.Fuel')
}
function getStartFuel() {
	isStartOfRace()
	return sessionDetails.startFuel
}
function getEndFuel() {
	sessionOdo = getSessionOdo()
	remainingDistance = (getTotalLaps() * getTrackLength()) - sessionOdo
	currentFuel = getCurrentFuel()
	fuelUsagePerDistance = (currentFuel - getStartFuel()) / sessionOdo

	return (fuelUsagePerDistance * remainingDistance) + currentFuel
}
/* --- END FUEL --- */


/* --- SUPPORT --- */
// Player Stuff
function getPlayerPos() { // returns 1-20
	return $prop('DataCorePlugin.GameData.NewData.Position');
}
function isInPitLane() {
	inPitLane = $prop('DataCorePlugin.GameData.NewData.IsInPit') == 1
	if (inPitLane && !sessionDetails.inPitLane) { // player is entering pit box
		stintDetails.lastPitOdo = getSessionOdo()
		stintDetails.lapCount = getCurrentLap() - stintDetails.startLap + 1 // because pit entrance is before start finish line
		stintDetails.endTireWears = getTireWears()
		stintDetails.endFuel = getCurrentFuel()
	  stintDetails.endERS = getERS()
		stintDetails.endPosition = getPlayerPos()
	} else if (!inPitLane && sessionDetails.inPitLane) { // player is leaving pit box
		stintDetails = new StintDetails()
	}
	sessionDetails.inPitLane = inPitLane
	return sessionDetails.inPitLane
}
function getLocalSpeed() {
	return $prop('DataCorePlugin.GameData.NewData.SpeedLocal')
}
function getERS() {
	return $prop('DataCorePlugin.GameData.NewData.ERSStored') / 40000 // 4 mil capacity, converted to percent
}
function getCurrentLapTime() { // returned as seconds
	lapTime = $prop('DataCorePlugin.GameData.NewData.CurrentLapTime').toString().split(":")
	return Number(lapTime[0]) * 3600 + Number(lapTime[1]) * 60 + Number(lapTime[2])
}

// Opponent Stuff
function getOpponentsCount() {
	return $prop('DataCorePlugin.GameData.NewData.OpponentsCount')
}

// Position Stuff
function getLastPointsPos() { // based on formula (class)
	formula = getFormula()
	if ([0, 1].indexOf(formula) >= 0) { // not actually sure what last points is for fclassic
		return 10;
	} else if (formula == 2) {
		return 8;
	}
}
function getLastPos() { // returns 1-20, may need to adjust if this does not count for DNFs
	return getOpponentsCount()
}

// Better Odos
// the in game odos are fucked, they don't stop when paused, but *lapDistance does*
// the fix: (current lap - 1) * track length + lapDistance * track length
function getSessionOdo() {
	completedLapsDistance = (getCurrentLap() - 1) * getTrackLength()
	currentLapDistance = getLapDistance(getPlayerPos()) * getTrackLength()
	return currentLapDistance + completedLapsDistance
}
function getStintOdo() {
	return getSessionOdo() - stintDetails.lastPitOdo
}

// Session Details
function getSessionTypeName() {
	return $prop('DataCorePlugin.GameData.NewData.SessionTypeName')
}
function getCurrentLap() {
	return $prop('DataCorePlugin.GameData.NewData.CurrentLap')
}
function getTotalLaps() {
	return $prop('DataCorePlugin.GameData.NewData.TotalLaps')
}
function getTrackLength() {
	return $prop('DataCorePlugin.GameData.NewData.TrackLength')
}
function getSessionTimeLeft() { // returned as minutes
	time = $prop('DataCorePlugin.GameData.NewData.SessionTimeLeft').toString().split(':') // HH:MM:SS
	minutes = parseInt(time[0]) * 60 + parseInt(time[1]);
	seconds = time[2]
	return (minutes + ':' + seconds).padStart(5, '0');
}
function getFormula() { // 0 = F1, 1 = FClassic, 2 = F2 
	return $prop('DataCorePlugin.GameRawData.PacketSessionData.m_formula');
}
function isStartOfRace() {
	if (getCurrentLapTime() == 0 && getCurrentLap() == 1) { // start of race
		sessionDetails = new SessionDetails()
		stintDetails = new StintDetails()
		return true
	} else {return false}
}

// Random Stuff
function getSecondsFromLap(lap) { // lap is a string MM:SS.000
	return parseInt(lap.slice(0,2)) * 60 + parseFloat(lap.slice(3))
}
function getLapDistance(pos) { // pos is 1-20
	pos = (pos-1).toString().padStart(2, "0")
	return $prop('GarySwallowDataPlugin.Opponent'+pos+'.LapDistance')
}
function getSector(pos) { // pos is 1-20
	pos -= 1
	return sessionDetails.sectorTimes[pos].indexOf(Math.max.apply(Math, sessionDetails.sectorTimes[pos]))
}
/* ---  END SUPPORT --- */


/* --- BORDERLINE STUFF */
function lastLapPitIn() {
	let isInPit = $prop('DataCorePlugin.GameData.NewData.IsInPit'),
			currentLap = $prop('DataCorePlugin.GameData.NewData.CurrentLap');

	if (root.pitLaneLap == null || $prop('DataCorePlugin.GameRunning') == 0) {
			root.pitLaneLap = 0;
			root.storeLap = true;
	}

	if (isInPit && root.pitLaneLap !== currentLap && root.storeLap) {
			root.pitLaneLap = currentLap;
			root.storeLap = false;
	}

	if (!isInPit) {
			root.storeLap = true;
	}

	return root.pitLaneLap;    
}
function SearchTeam(position) {
	var TeamColour = 'Transparent';
	var Team = null;

	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent00.RacePosition (Not Grid 00)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent00.TeamID (Not Grid 00)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent01.RacePosition (Not Grid 01)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent01.TeamID (Not Grid 01)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent02.RacePosition (Not Grid 02)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent02.TeamID (Not Grid 02)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent03.RacePosition (Not Grid 03)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent03.TeamID (Not Grid 03)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent04.RacePosition (Not Grid 04)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent04.TeamID (Not Grid 04)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent05.RacePosition (Not Grid 05)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent05.TeamID (Not Grid 05)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent06.RacePosition (Not Grid 06)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent06.TeamID (Not Grid 06)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent07.RacePosition (Not Grid 07)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent07.TeamID (Not Grid 07)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent08.RacePosition (Not Grid 08)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent08.TeamID (Not Grid 08)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent09.RacePosition (Not Grid 09)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent09.TeamID (Not Grid 09)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent10.RacePosition (Not Grid 10)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent10.TeamID (Not Grid 10)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent11.RacePosition (Not Grid 11)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent11.TeamID (Not Grid 11)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent12.RacePosition (Not Grid 12)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent12.TeamID (Not Grid 12)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent13.RacePosition (Not Grid 13)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent13.TeamID (Not Grid 13)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent14.RacePosition (Not Grid 14)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent14.TeamID (Not Grid 14)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent15.RacePosition (Not Grid 15)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent15.TeamID (Not Grid 15)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent16.RacePosition (Not Grid 16)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent16.TeamID (Not Grid 16)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent17.RacePosition (Not Grid 17)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent17.TeamID (Not Grid 17)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent18.RacePosition (Not Grid 18)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent18.TeamID (Not Grid 18)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent19.RacePosition (Not Grid 19)') == position) {Team = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent19.TeamID (Not Grid 19)')};
	
	if (Team == '2'){TeamColour = '#1E41FF'};//Red Bull
	if (Team == '1'){TeamColour = '#DC0000'};//Ferrari
	if (Team == '8'){TeamColour = '#FF8700'};//McLaren
	if (Team == '5'){TeamColour = '#FFF500'};//Renault
	if (Team == '0'){TeamColour = '#00D2BE'};//Mercedes
	if (Team == '9'){TeamColour = '#9B0000'};//Alfa Romeo
	if (Team == '4'){TeamColour = '#F596C8'};//Racing Point
	if (Team == '3'){TeamColour = '#FFFFFF'};//Williams
	if (Team == '6'){TeamColour = '#469BFF'};//Toro Rosso
	if (Team == '7'){TeamColour = '#bd9e57'};//Haas
	
	return TeamColour;
}
function SearchTyreCompound(position) {
	var Compound = null;
	

	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent00.RacePosition (Not Grid 00)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent00.TyreCompound (Not Grid 00)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent01.RacePosition (Not Grid 01)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent01.TyreCompound (Not Grid 01)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent02.RacePosition (Not Grid 02)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent02.TyreCompound (Not Grid 02)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent03.RacePosition (Not Grid 03)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent03.TyreCompound (Not Grid 03)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent04.RacePosition (Not Grid 04)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent04.TyreCompound (Not Grid 04)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent05.RacePosition (Not Grid 05)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent05.TyreCompound (Not Grid 05)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent06.RacePosition (Not Grid 06)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent06.TyreCompound (Not Grid 06)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent07.RacePosition (Not Grid 07)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent07.TyreCompound (Not Grid 07)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent08.RacePosition (Not Grid 08)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent08.TyreCompound (Not Grid 08)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent09.RacePosition (Not Grid 09)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent09.TyreCompound (Not Grid 09)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent10.RacePosition (Not Grid 10)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent10.TyreCompound (Not Grid 10)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent11.RacePosition (Not Grid 11)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent11.TyreCompound (Not Grid 11)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent12.RacePosition (Not Grid 12)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent12.TyreCompound (Not Grid 12)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent13.RacePosition (Not Grid 13)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent13.TyreCompound (Not Grid 13)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent14.RacePosition (Not Grid 14)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent14.TyreCompound (Not Grid 14)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent15.RacePosition (Not Grid 15)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent15.TyreCompound (Not Grid 15)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent16.RacePosition (Not Grid 16)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent16.TyreCompound (Not Grid 16)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent17.RacePosition (Not Grid 17)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent17.TyreCompound (Not Grid 17)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent18.RacePosition (Not Grid 18)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent18.TyreCompound (Not Grid 18)')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent19.RacePosition (Not Grid 19)') == position) {Compound = $prop('GarySwallowDataPlugin.F1201xOnly.Opponent19.TyreCompound (Not Grid 19)')};
	
	return {
    16: 'red',
    17: 'gold',
    18: 'white',
    7: 'green',
    8: 'blue',
    11: 'purple',
    12: 'red',
    13: 'gold',
    14: 'white',
    15: 'blue',
    9: 'white',
    10: 'blue',
	}[Compound];
}
function SearchPositionsGainedImage(position) {
	var Image = null;
	var gained = -99;
	
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent00.RacePosition (Not Grid 00)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent00')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent01.RacePosition (Not Grid 01)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent01')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent02.RacePosition (Not Grid 02)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent02')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent03.RacePosition (Not Grid 03)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent03')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent04.RacePosition (Not Grid 04)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent04')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent05.RacePosition (Not Grid 05)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent05')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent06.RacePosition (Not Grid 06)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent06')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent07.RacePosition (Not Grid 07)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent07')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent08.RacePosition (Not Grid 08)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent08')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent09.RacePosition (Not Grid 09)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent09')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent10.RacePosition (Not Grid 10)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent10')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent11.RacePosition (Not Grid 11)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent11')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent12.RacePosition (Not Grid 12)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent12')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent13.RacePosition (Not Grid 13)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent13')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent14.RacePosition (Not Grid 14)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent14')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent15.RacePosition (Not Grid 15)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent15')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent16.RacePosition (Not Grid 16)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent16')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent17.RacePosition (Not Grid 17)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent17')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent18.RacePosition (Not Grid 18)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent18')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent19.RacePosition (Not Grid 19)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent19')}
	
	if (gained > 0) {Image = 'GreenUp'};
	if (gained < 0) {Image = 'RedDown'};
	if (gained == 0) {Image = 'BlueStay'};
	if (gained == -99) {Image = null};
	
	return Image;
}
function SearchPositionsGained(position) {
	var gained = -99;
	
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent00.RacePosition (Not Grid 00)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent00')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent01.RacePosition (Not Grid 01)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent01')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent02.RacePosition (Not Grid 02)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent02')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent03.RacePosition (Not Grid 03)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent03')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent04.RacePosition (Not Grid 04)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent04')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent05.RacePosition (Not Grid 05)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent05')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent06.RacePosition (Not Grid 06)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent06')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent07.RacePosition (Not Grid 07)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent07')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent08.RacePosition (Not Grid 08)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent08')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent09.RacePosition (Not Grid 09)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent09')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent10.RacePosition (Not Grid 10)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent10')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent11.RacePosition (Not Grid 11)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent11')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent12.RacePosition (Not Grid 12)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent12')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent13.RacePosition (Not Grid 13)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent13')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent14.RacePosition (Not Grid 14)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent14')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent15.RacePosition (Not Grid 15)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent15')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent16.RacePosition (Not Grid 16)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent16')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent17.RacePosition (Not Grid 17)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent17')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent18.RacePosition (Not Grid 18)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent18')}
	if (position == $prop('GarySwallowDataPlugin.F1201xOnly.Opponent19.RacePosition (Not Grid 19)')) {gained = $prop('DataCorePlugin.ExternalScript.PositionsGainedOpponent19')}
	
	if (gained < 0) {gained = gained * -1};
	if (gained == -99) {gained = null};
	
	return gained;
}
function SearchDNFStatus(position) {
	
	var DNFStatus = 'False';
	var Visible = 0;
	
	if (position == $prop('GarySwallowDataPlugin.Opponent00.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent00.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent01.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent01.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent02.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent02.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent03.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent03.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent04.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent04.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent05.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent05.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent06.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent06.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent07.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent07.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent08.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent08.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent09.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent09.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent10.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent10.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent11.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent11.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent12.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent12.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent13.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent13.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent14.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent14.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent15.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent15.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent16.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent16.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent17.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent17.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent18.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent18.DNFStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent19.RacePosition ')){DNFStatus = $prop('GarySwallowDataPlugin.Opponent19.DNFStatus')};
	if (DNFStatus == true){Visible = 1};
	
	return Visible;
}
function SearchDSQStatus(position) {
	
	var DSQStatus = 'False';
	var Visible = 0;
	
	if (position == $prop('GarySwallowDataPlugin.Opponent00.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent00.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent01.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent01.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent02.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent02.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent03.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent03.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent04.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent04.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent05.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent05.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent06.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent06.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent07.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent07.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent08.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent08.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent09.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent09.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent10.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent10.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent11.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent11.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent12.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent12.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent13.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent13.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent14.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent14.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent15.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent15.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent16.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent16.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent17.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent17.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent18.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent18.DQStatus')};
	if (position == $prop('GarySwallowDataPlugin.Opponent19.RacePosition ')){DSQStatus = $prop('GarySwallowDataPlugin.Opponent19.DQStatus')};
	if (DSQStatus == true){Visible = 1};
	
	return Visible;
}
function SearchPitStatus(position) {

	var inPit = 0;
	
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent00.RacePosition (Not Grid 00)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent00.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent01.RacePosition (Not Grid 01)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent01.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent02.RacePosition (Not Grid 02)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent02.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent03.RacePosition (Not Grid 03)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent03.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent04.RacePosition (Not Grid 04)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent04.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent05.RacePosition (Not Grid 05)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent05.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent06.RacePosition (Not Grid 06)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent06.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent07.RacePosition (Not Grid 07)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent07.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent08.RacePosition (Not Grid 08)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent08.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent09.RacePosition (Not Grid 09)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent09.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent10.RacePosition (Not Grid 10)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent10.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent11.RacePosition (Not Grid 11)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent11.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent12.RacePosition (Not Grid 12)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent12.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent13.RacePosition (Not Grid 13)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent13.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent14.RacePosition (Not Grid 14)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent14.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent15.RacePosition (Not Grid 15)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent15.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent16.RacePosition (Not Grid 16)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent16.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent17.RacePosition (Not Grid 17)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent17.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent18.RacePosition (Not Grid 18)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent18.PitBoxStatusLivePos')};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent19.RacePosition (Not Grid 19)') == position) {inPit = $prop('GarySwallowDataPlugin.Opponent19.PitBoxStatusLivePos')};
	
	return inPit;
}
function LapDeltaToFront() {
	
	var Position = $prop('DataCorePlugin.GameData.NewData.Position');
	var FrontPosition = Position - 1;
	var LaptimeDriver = null;
	var LaptimeFront = null;
	var LapCountDriver = null;
	var LaptimeDelta = null;
	
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent00.RacePosition (Not Grid 00)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent00.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent00.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent01.RacePosition (Not Grid 01)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent01.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent01.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent02.RacePosition (Not Grid 02)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent02.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent02.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent03.RacePosition (Not Grid 03)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent03.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent03.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent04.RacePosition (Not Grid 04)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent04.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent04.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent05.RacePosition (Not Grid 05)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent05.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent05.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent06.RacePosition (Not Grid 06)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent06.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent06.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent07.RacePosition (Not Grid 07)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent07.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent07.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent08.RacePosition (Not Grid 08)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent08.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent08.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent09.RacePosition (Not Grid 09)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent09.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent09.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent10.RacePosition (Not Grid 10)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent10.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent10.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent11.RacePosition (Not Grid 11)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent11.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent11.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent12.RacePosition (Not Grid 12)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent12.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent12.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent13.RacePosition (Not Grid 13)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent13.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent13.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent14.RacePosition (Not Grid 14)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent14.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent14.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent15.RacePosition (Not Grid 15)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent15.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent15.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent16.RacePosition (Not Grid 16)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent16.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent16.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent17.RacePosition (Not Grid 17)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent17.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent17.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent18.RacePosition (Not Grid 18)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent18.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent18.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent19.RacePosition (Not Grid 19)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent19.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent19.LapLAST');};
	
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent00.RacePosition (Not Grid 00)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent00.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent01.RacePosition (Not Grid 01)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent01.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent02.RacePosition (Not Grid 02)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent02.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent03.RacePosition (Not Grid 03)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent03.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent04.RacePosition (Not Grid 04)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent04.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent05.RacePosition (Not Grid 05)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent05.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent06.RacePosition (Not Grid 06)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent06.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent07.RacePosition (Not Grid 07)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent07.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent08.RacePosition (Not Grid 08)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent08.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent09.RacePosition (Not Grid 09)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent09.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent10.RacePosition (Not Grid 10)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent10.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent11.RacePosition (Not Grid 11)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent11.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent12.RacePosition (Not Grid 12)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent12.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent13.RacePosition (Not Grid 13)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent13.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent14.RacePosition (Not Grid 14)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent14.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent15.RacePosition (Not Grid 15)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent15.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent16.RacePosition (Not Grid 16)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent16.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent17.RacePosition (Not Grid 17)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent17.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent18.RacePosition (Not Grid 18)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent18.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent19.RacePosition (Not Grid 19)') == FrontPosition) {LaptimeFront = $prop('GarySwallowDataPlugin.Opponent19.LapLAST');};
	
	if (FrontPosition != 0) {
		LaptimeDelta = LaptimeDriver - LaptimeFront;
	}
	
	if (FrontPosition == 0) {
		LaptimeDelta = null;
	}
	
	return LaptimeDelta;
}
function LapDeltaToRear() {
	
	var Position = $prop('DataCorePlugin.GameData.NewData.Position');
	var RearPosition = Position + 1;
	var LastPosition = $prop('DataCorePlugin.GameData.NewData.OpponentsCount');
	var LaptimeDriver = null;
	var LaptimeRear = null;
	var LapCountDriver = null;
	var LaptimeDelta = null;
	
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent00.RacePosition (Not Grid 00)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent00.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent00.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent01.RacePosition (Not Grid 01)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent01.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent01.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent02.RacePosition (Not Grid 02)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent02.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent02.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent03.RacePosition (Not Grid 03)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent03.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent03.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent04.RacePosition (Not Grid 04)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent04.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent04.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent05.RacePosition (Not Grid 05)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent05.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent05.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent06.RacePosition (Not Grid 06)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent06.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent06.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent07.RacePosition (Not Grid 07)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent07.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent07.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent08.RacePosition (Not Grid 08)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent08.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent08.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent09.RacePosition (Not Grid 09)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent09.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent09.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent10.RacePosition (Not Grid 10)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent10.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent10.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent11.RacePosition (Not Grid 11)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent11.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent11.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent12.RacePosition (Not Grid 12)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent12.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent12.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent13.RacePosition (Not Grid 13)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent13.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent13.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent14.RacePosition (Not Grid 14)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent14.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent14.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent15.RacePosition (Not Grid 15)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent15.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent15.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent16.RacePosition (Not Grid 16)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent16.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent16.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent17.RacePosition (Not Grid 17)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent17.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent17.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent18.RacePosition (Not Grid 18)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent18.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent18.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent19.RacePosition (Not Grid 19)') == Position) {LapCountDriver = $prop('GarySwallowDataPlugin.Opponent19.LapDistance'); LaptimeDriver = $prop('GarySwallowDataPlugin.Opponent19.LapLAST');};
	
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent00.RacePosition (Not Grid 00)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent00.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent01.RacePosition (Not Grid 01)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent01.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent02.RacePosition (Not Grid 02)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent02.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent03.RacePosition (Not Grid 03)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent03.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent04.RacePosition (Not Grid 04)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent04.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent05.RacePosition (Not Grid 05)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent05.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent06.RacePosition (Not Grid 06)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent06.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent07.RacePosition (Not Grid 07)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent07.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent08.RacePosition (Not Grid 08)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent08.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent09.RacePosition (Not Grid 09)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent09.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent10.RacePosition (Not Grid 10)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent10.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent11.RacePosition (Not Grid 11)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent11.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent12.RacePosition (Not Grid 12)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent12.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent13.RacePosition (Not Grid 13)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent13.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent14.RacePosition (Not Grid 14)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent14.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent15.RacePosition (Not Grid 15)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent15.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent16.RacePosition (Not Grid 16)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent16.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent17.RacePosition (Not Grid 17)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent17.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent18.RacePosition (Not Grid 18)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent18.LapLAST');};
	if ($prop('GarySwallowDataPlugin.F1201xOnly.Opponent19.RacePosition (Not Grid 19)') == RearPosition) {LaptimeRear = $prop('GarySwallowDataPlugin.Opponent19.LapLAST');};
	
	if (RearPosition != LastPosition) {
		LaptimeDelta = LaptimeRear - LaptimeDriver;
	}
	
	if (RearPosition == LastPosition) {
		LaptimeDelta = null;
	}
	
	return LaptimeDelta;
	
}
/* --- END BORDERLINE STUFF --- */