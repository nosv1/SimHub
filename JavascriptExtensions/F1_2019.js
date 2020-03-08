/* 
	A Driver's Dash by Mo#9991

	The idea behind this dash, is to deliver the information the driver needs at a given moment. In race, you're interested in the general deltas between your closest rivals, and perhaps a few more. You need to know the current state of your wings, the amount of penalties, how much fuel you're using as well as how fast your tires are degrading. Then upon entering the pit, you can go into detail about what your pace is, are you hitting the pace you need, where's everyone else at on track...
	
	The file itself, has 2 main 'classes/objets' stint and session details, as well an one function that runs a series of instructions using the support functions within this file, these support functions update the details 60 times a second, and reset at the start of the race as well as resetting the stint upon leavig the pit. 
*/

var t = 1

/* --- SETUP --- */
function StintDetails() { // update isInPitLane() if you update this
	this.startOdo = sessionDetails.sessionOdo
	this.stintOdo = null
	this.lapNumber = 1

	this.startPos = getPlayerPos()
	this.endPos = null

	this.compound = getVisualTireCompound()
	this.startTireWears = getTireWears()
	this.endTireWears = null
	this.averageTireWear = null

	this.startFuel = getCurrentFuel()
	this.endFuel = null
	this.averageFuel = null

	this.startERS = getERS()
	this.endERS = null

	this.lapTimes = [] // player lap times
	this.bestLap = null
	this.worstLap = null
	this.averageLap = null
}
function SessionDetails() {
	this.sessionOdo = null
	this.lapNumber = 1
	this.trackLength = getTrackLength()
	this.totalLaps = getTotalLaps()

	this.currentMaxTireWear = null
	this.predictedEndTireWear = null

	this.startFuel = getCurrentFuel()
	this.currentFuel = null
	this.averageFuel = null
	this.predictedEndFuel = null

	this.player = new Player()
	this.opponents = setupOpponents() // array of opponent objects
	this.lapTimes = [] // player lap times

	this.inPitLane = false
}

function Player() {
	this.playerPos = 100
	this.opponentAverageLapTimes = [] // P-2, P-1, Player, P+1, P+2
}
function PlayerLap() {
	this.lastLapTime = getLastLapTimePlayer()
	this.sector1 = getSectorLastLapTime(1)
	this.sector2 = getSectorLastLapTime(2)
	this.sector3 = getSectorLastLapTime(3)
}

function Opponent() {
	this.opponent = -1
	this.position = -1
	this.sectorTimes = [] // array of laps, with array of sector time stamps, sector time stamp array is appened in updateSectors() on new lap
	this.lapNumber = 0
	this.lapDistance = null
	this.dnf = false
	this.inPitLane = false
	this.lapTimes = []
}
Opponent.prototype.toString = function() {
	sectors = ""
	for (var i = 0; i < this.sectorTimes.length; i++) {
		sectors += "Lap: " + (i+1) + "\n"
		for (var j = 0; j < this.sectorTimes[i].length; j++) {
			sectors += "S" + (j+1) + ": " + this.sectorTimes[i][j] + " "
		}
		sectors += "\n"
	}
	sectors = sectors.slice(0, sectors.length-1)
	return "Opponent: " + this.opponent + "\nSectorTimes: " + sectors + "\nLap Distance: " + this.lapDistance + "\nLap Number: " + this.lapNumber
}

const numSectors = 30
var sessionDetails = new SessionDetails()
var stintDetails = new StintDetails()

function update() { // update everything every time
	var startOfRace = isStartOfRace()
	var inPitLane = isInPitLane()
	var lapNumber = getCurrentLap()
	sessionDetails.player.playerPos = getPlayerPos()
	for (var i = 0; i < sessionDetails.opponents.length; i++) {
		sessionDetails.opponents[i].position = getOpponenetPosition(i)
	}

	sessionDetails.sessionOdo = getSessionOdo()
	stintDetails.stintOdo = getStintOdo()

	sessionDetails.currentMaxTireWear = getMaxTireWear()
	sessionDetails.predictedEndTireWear = predictEndTireWear()

	sessionDetails.currentFuel = getCurrentFuel()
	sessionDetails.predictedEndFuel = predictEndFuel()
	
	temp = getLapDistances() // temp[0] lapDistances, temp[1] lastLapTimes
	updateSectors(temp[0], temp[1])
	updateAverageLapTimes()

	if (false && lapNumber != sessionDetails.lapNumber) { // detect new lap
		playerLap = new PlayerLap()
		stintDetails.lapTimes.push(playerLap)
		sessionDetails.lapTimes.push(playerLap)
		keyLapTimes = getKeyStintLapTimes(stintDetails.lapTimes)
		stintDetails.bestLap = keyLapTimes[0]
		stintDetails.worstLap = keyLapTimes[1]
		stintDetails.averageLap = keyLapTimes[2]
		stintDetails.lapNumber += 1
	}

	sessionDetails.lapNumber = lapNumber
}
/* --- END SETUP --- */


/* --- DELTAS --- */
function updateSectors(lapDistances, lastLapTimes) { // lap distances, based on position, lapTimes not based on position
	for (var pos = 0; pos < sessionDetails.opponents.length; pos++) {
		opponent = null
		opponentID = -1
		for (var i = 0; i < sessionDetails.opponents.length; i++) {
			if (sessionDetails.opponents[i].position == pos+1) {
				opponent = sessionDetails.opponents[i]
				opponentID = i
				break
			}
		}

		var opponentLapDistance = lapDistances[0][pos]
		var opponentLastLapTime = lastLapTimes[0][opponentID]
		var opponentLapNumber = getLapNumber(opponentID)
		var sector = getSectorFromLapDistance(opponentLapDistance)

		sessionDetails.opponents[pos].lapDistance = opponentLapDistance

		if (opponentLapNumber > opponent.lapNumber) { // new lap
			sessionDetails.opponents[opponentID].lapNumber = opponentLapNumber

			if (opponent.lapNumber > 1 && opponent.lapNumber - 1 > opponent.lapTimes.length) { // add lap time if lap number is > count of laps in array
				sessionDetails.opponents[opponentID].lapTimes.push(opponentLastLapTime)
			}
			
			var sectors = []
			for (var i = 0; i < numSectors; i++) {
				sectors.push(null)
			}
			sessionDetails.opponents[opponentID].sectorTimes.push(sectors) // new lap with null sectors
		}

		var lapNumber = opponent.lapNumber - 1 // for indexing below, not setting any laps counts with this
		var now = new Date().getTime()
		if (now - opponent.sectorTimes[lapNumber][sector] > 30000 || opponent.sectorTimes[lapNumber][sector] === null) { // only update once per sector
			sessionDetails.opponents[opponentID].sectorTimes[lapNumber][sector] = now
		}
	}
}
function getDeltaToOppPos(oppPos) { // oppPos is 1-20
	var playerPos = getPlayerPos()
	var player = null
	var playerID = null
	var opponent = null
	var opponentID = null
	for (var i = 0; i < sessionDetails.opponents.length; i++) {
		if (sessionDetails.opponents[i].position == oppPos) {
			opponent = getLastUpdatedSector(sessionDetails.opponents[i]) // not sessionDetails opponent
			opponentID = i
		}
		if (sessionDetails.opponents[i].position == playerPos) {
			player = getLastUpdatedSector(sessionDetails.opponents[i]) // not sessionDetails player
			playerID = i
		} 
		if (playerID != null && opponentID != null) {
			break
		}
	}

	var lapNumber = player.lapNumber <= opponent.lapNumber ? player.lapNumber : opponent.lapNumber // get lap number of guy behind
	var sector = null 
	if (player.lapNumber <= opponent.lapNumber) { // check if opponent is behind
		lapNumber = player.lapNumber

		if (player.lapNumber == opponent.lapNumber) { // if same lap, figure out who is behind in sectors

			if (player.sector <= opponent.sector) { // if player is behind, use player's sector
				sector = player.sector
			} else { // opponent is behind
				sector = opponent.sector
			}

		} else { // player is behind
			sector = player.sector
		}

	} else { // opponent is behind
		lapNumber = opponent.lapNumber
		sector = opponent.sector
	}

	return (sessionDetails.opponents[playerID].sectorTimes[lapNumber][sector] - sessionDetails.opponents[opponentID].sectorTimes[lapNumber][sector]) / -1000
}
/* --- END DELTAS --- */


/* --- LAP TIMES --- */
function updateAverageLapTimes() {
	playerPos = sessionDetails.player.playerPos

	lapTimes = [] // array of 5 most recent lapTimes of -2 to +2 of player position
	medians = []
	relevantLapTimes = []
	for (var i = -2; i <= 2; i++) {
		opponent = null
		for (var j = 0; j < sessionDetails.opponents.length; j++) {
			if (sessionDetails.opponents[j].position == playerPos+i) {
				opponent = sessionDetails.opponents[j]
				break
			}
		} // opponent may be null if player is p1, 2, 19, 20

		if (playerPos+i < 0 || playerPos+i > sessionDetails.opponents.length - 1 || opponent.lapNumber <= 1) {
			lapTimes.push([])
			continue
		}

		lapTimes.push(
			opponent.lapTimes.slice(
				opponent.lapTimes.length - (
					opponent.lapNumber < 5 ? opponent.lapTimes.length : 5
				)
			) // last 5 laps or since beginning of race
		)
	}

	sessionDetails.player.opponentAverageLapTimes = []
	for (var i = 0; i < lapTimes.length; i++) {
		if (lapTimes[i].length == 0) {
			sessionDetails.player.opponentAverageLapTimes.push("")
			continue
		}
		
		lapTimes[i].sort()
		if (lapTimes[i].length > 1) {
			medians.push((lapTimes[i][Math.floor((lapTimes[i].length - 1) / 2)] + lapTimes[i][Math.ceil((lapTimes[i].length - 1) / 2)]) / 2)
		} else { medians.push(lapTimes[i][0]) }

		t = []
		for (var j = 0; j < lapTimes[i].length; j++) {
			if (Math.abs(1 - lapTimes[i][j] / medians[i]) < .02) {
				t.push(lapTimes[i][j])
			}
		}
		relevantLapTimes.push(t)
		
		if (relevantLapTimes[i].length == 0) { // if lap 2 add quickest time
			sessionDetails.player.opponentAverageLapTimes.push(
				convertSecondsToLap(lapTimes[i][0]))
		} else {
			sessionDetails.player.opponentAverageLapTimes.push(
				convertSecondsToLap(relevantLapTimes[i].reduce(
						function(a, b) { return a += b }, 0
					) / relevantLapTimes[i].length
				)
			)
		}
	}	
}
/* --- END LAP TIMES --- */


/* --- TIRE WEAR --- */
function getTireWears() { // returning [left front, right front, left rear, right rear]
	return [
		100-$prop('DataCorePlugin.GameData.NewData.TyreWearFrontLeft'), // game starts at 100 as tire life left, not giving tire wear
		100-$prop('DataCorePlugin.GameData.NewData.TyreWearFrontRight'), 
		100-$prop('DataCorePlugin.GameData.NewData.TyreWearRearLeft'), 
		100-$prop('DataCorePlugin.GameData.NewData.TyreWearRearRight')
	]
}
function getMaxTireWear() {
	var maxTireWear = max(getTireWears())
	return maxTireWear;
}
function predictEndTireWear() {
	var remainingDistance = (sessionDetails.totalLaps * sessionDetails.trackLength) - sessionDetails.sessionOdo
	var stintWearPerDistance = getWearPerDistance(sessionDetails.currentMaxTireWear)

	stintDetails.averageTireWear = stintWearPerDistance * sessionDetails.trackLength
	return (stintWearPerDistance * remainingDistance) + sessionDetails.currentMaxTireWear
}
function getWearPerDistance(maxTireWear) {
	return (maxTireWear - max(stintDetails.startTireWears)) / stintDetails.stintOdo
}
/* --- END TIRE WEAR --- */


/* --- FUEL --- */
function getCurrentFuel() {
	return $prop('DataCorePlugin.GameData.NewData.Fuel')
}
function predictEndFuel() {
	var remainingDistance = (sessionDetails.totalLaps * sessionDetails.trackLength) - sessionDetails.sessionOdo
	var sessionFuelUsagePerDistance = (sessionDetails.startFuel - sessionDetails.currentFuel) / sessionDetails.sessionOdo
	var stintFuelUsagePerDistance = (stintDetails.startFuel - sessionDetails.currentFuel) / stintDetails.stintOdo

	stintDetails.averageFuel = stintFuelUsagePerDistance * sessionDetails.trackLength
	sessionDetails.averageFuel = sessionFuelUsagePerDistance * sessionDetails.trackLength
	return sessionDetails.currentFuel - (sessionFuelUsagePerDistance * remainingDistance)
}
/* --- END FUEL --- */


/* --- SUPPORT --- */
// Player Stuff
function getPlayerPos() { // returns 1-20
	return $prop('DataCorePlugin.GameData.NewData.Position');
}
function isInPitLane() {
	var inPitLane = $prop('DataCorePlugin.GameData.NewData.IsInPit') == 1
	if (inPitLane && !sessionDetails.inPitLane) { // player is entering pit lane
		stintDetails.endOdo = getSessionOdo()
		stintDetails.endPosition = getPlayerPos()
		stintDetails.endTireWears = getTireWears()
		stintDetails.endFuel = getCurrentFuel()
	  stintDetails.endERS = getERS()
	} else if (!inPitLane && sessionDetails.inPitLane) { // player is leaving pit lane
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
	var lapTime = $prop('DataCorePlugin.GameData.NewData.CurrentLapTime').toString().split(":")
	return Number(lapTime[0]) * 3600 + Number(lapTime[1]) * 60 + Number(lapTime[2])
}
function getVisualTireCompound() {
	var compounds = {
		16 : '2019 SOFT',
		17 : '2019 MEDIUM',
		18 : '2019 HARD',
		7 : 'INTER',
		8 : 'WET',
		11 : 'SUPERSOFT',
		12 : 'SOFT',
		13 : 'MEDIUM',
		14 : 'HARD',
		15 : 'WET',
		9 : 'MEDIUM',
		10 : 'WET',
		19 : 'ULTRASOFT',
		20 : 'SUPERSOFT',
		21 : 'SOFT',
		22 : 'MEDIUM'
	}
	return compounds[$prop('DataCorePlugin.GameRawData.PlayerCarStatusData.m_tyreVisualCompound')]
}
function getSectorLastLapTime(sector) {
	return $prop('DataCorePlugin.GameData.NewData.Sector'+sector+'LastLapTime').toString()
}
function getProximities(lapDistances) {
	for (var i = 0; i < lapDistances[0].length; i++) {
		oppLapDist = lapDistances[0][i]
		playerLapDist = lapDistances[1]
		lapDistances[0][i] = oppLapDist == 0 || oppLapDist > playerLapDist ? 1 : playerLapDist - oppLapDist
	}
	return lapDistances[0].sort() // now sorted based on how close opponenets are to player
}
function getLastLapTimePlayer() {
	return $prop('DataCorePlugin.GameData.NewData.LastLapTime')
}

// Stint Lap Times
function getKeyStintLapTimes(lapTimes) { // best, worst, avg, possbile (based on best sectors)
	var best = null
	var worst = null
	var average = []
	for (var i = 0; i < lapTimes.length; i++) {
		var lap = getSecondsFromLap(lapTimes[i].lastLapTime.slice(4))
		average.push(lap)
		if (best === null || lap < best) {
			best = lap
		}
		if (worst === null || lap > best) {
			worst = lap
		}
	}
	average = (average.reduce(function(a, b) {return a += b}, 0) / average.length).toFixed(3)
	return [convertSecondsToLap(best), convertSecondsToLap(worst), convertSecondsToLap(average)]
}

// Opponent Stuff
function getOpponentsCount() {
	return $prop('DataCorePlugin.GameData.NewData.OpponentsCount')
}
function setupOpponents() {
	var opponents = []
	for (var i = 0; i < getOpponentsCount(); i++) {
		opponent = new Opponent
		opponent.opponent = i
		opponents.push(opponent)
	}
	return opponents
}
function getLapDistances() { // returning lapDistances[[all], player]
	playerPos = sessionDetails.player.playerPos
	lapDistances = [[]]
	lastLapTimes = [[]]
	for (var i = 0; i < getOpponentsCount(); i++){
		lapDistance = getLapDistance(i+1)
		lapDistances[0].push(lapDistance)
		lapTime = getLastLapTime(i)
		lastLapTimes[0].push(lapTime)
		if (i+1 == playerPos) {
			lapDistances.push(lapDistance)
			lastLapTimes.push(lapTime)
		}
	}
	return [lapDistances, lastLapTimes]
}
function getOpponenetPosition(i) { // 0 - 19
	var i = i.toString().padStart(2, "0")
	return $prop('PluginDeMo.F1_Driver_'+i+'_Position')
}

// Position Stuff
function getLastPointsPos() { // based on formula (class)
	var formula = getFormula()
	if ([0, 1].indexOf(formula) >= 0) { // not actually sure what last points is for fclassic
		return 10;
	} else if (formula == 2) {
		return 8;
	}
}
function getLastPos() { // counting dnfs
	return getOpponentsCount() - getDNFCount()
}
function updateDNFs() { // updates opponent objects in sessionDetails
	for (var i = 1; i <= getOpponentsCount(); i++) {
		sessionDetails.opponents[i].dnf = getOpponentDNFStatusFromGame(i) == true ? true : false // could be null
	}
}
function getDNFCount() {
	count = 0
	for (opponent in sessionDetails.opponents) {
		count += opponent.dnf ? 1 : 0
	}
	return count
}

// Better Odos
// the in game odos are fucked, they don't stop when paused, but *lapDistance does*
// the fix: (current lap - 1) * track length + lapDistance * track length
function getSessionOdo() {
	var completedLapsDistance = (getCurrentLap() - 1) * getTrackLength()
	var currentLapDistance = getLapDistance(getPlayerPos()) * getTrackLength()
	return currentLapDistance + completedLapsDistance
}
function getStintOdo() {
	return getSessionOdo() - stintDetails.startOdo
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
	var time = $prop('DataCorePlugin.GameData.NewData.SessionTimeLeft').toString().split(':') // HH:MM:SS
	var minutes = parseInt(time[0]) * 60 + parseInt(time[1]);
	var seconds = time[2]
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
function inPractice() {
	return [1, 2, 3, 4].indexOf($prop('DataCorePlugin.GameRawData.PacketSessionData.m_sessionType')) > -1	
}
function inQuali() {
	return [5, 6, 7, 8, 9].indexOf($prop('DataCorePlugin.GameRawData.PacketSessionData.m_sessionType')) > -1
}
function inRace() {
	return [10, 11].indexOf($prop('DataCorePlugin.GameRawData.PacketSessionData.m_sessionType')) > -1
}
function getOpponentDNFStatusFromGame(pos) { // pos is 1-20
	pos -= 1
	return $prop('GarySwallowDataPlugin.Opponent' + pos + '.DNFStatus')
}
function getWeather() {
	return {
		4: 'Heavy Rain',
		5: 'Heavy Rain',
		3: 'Light Rain',
		2: 'Overcast',
		1: 'Cloudy sun',
		0: 'Clear',
		6: 'Monsoon',
	}[$prop('DataCorePlugin.GameRawData.PacketSessionData.m_weather')]
}
function getSecondsFromLap(lap) { // lap is a string M:SS.000
	return parseInt(lap.slice(0,2)) * 60 + parseFloat(lap.slice(2))
}
function convertSecondsToLap(lap) { // 0.000
	var minutes = parseInt(lap / 60)
	var seconds = (lap - (minutes * 60)).toFixed(3)
	return minutes + ":" + seconds.toString().padStart(6, "0")
}
function getLastLapTime(i) { // i is 0-19
	var i = (i).toString().padStart(2, "0")
	return $prop('PluginDeMo.F1_Driver_'+i+'_Last_Lap_Time (Not Pos)')
}
function getLapDistance(pos) { // pos is 1-20
	var pos = (pos-1).toString().padStart(2, "0")
	return $prop('GarySwallowDataPlugin.Opponent'+pos+'.LapDistance')
}
function getSectorFromLapDistance(lapDistance) {
	return parseInt(lapDistance * numSectors)
}
function getLastUpdatedSector(driver) { // pos is 1-20
	pos -= 1
	var lapNumber = driver.lapNumber - 1
	var sector = driver.sectorTimes[lapNumber].indexOf(max(driver.sectorTimes[lapNumber]))
	return sector == -1 ? {lapNumber: lapNumber, sector: 0} : {lapNumber: lapNumber, sector: sector} // when sectors are all null, return 0
}
function getLapNumber(i) { // pos is 0-19
	var i = (i).toString().padStart(2, "0")
	return $prop('PluginDeMo.F1_Driver_'+i+'_Lap_Number (Not Pos)')
}
function drsAvailable() {
	return sessionDetails.lapNumber >= 3
}
function max(a) {
	return Math.max.apply(Math, a)
}
function min(a) {
	return Math.min.apply(Math, a)
}
/* ---  END SUPPORT --- */


/* --- BORDERLINE STUFF --- */
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