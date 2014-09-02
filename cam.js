// firstpersoncam.js
/*
Copyright 2008 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Code for a simple quake-style camera.
//
// Notes: This is a very simple camera and intended to be so. The 
// camera's altitude is always 0, relative to the surface of the
// earth.
//

//----------------------------------------------------------------------------
// Global Variables
//----------------------------------------------------------------------------

turnLeft = false;
turnRight = false;
tiltUp = false;
tiltDown = false;

moveForward = false;
moveBackward = false;
strafeLeft = false;
strafeRight = false;
altitudeUp = false;
altitudeDown = false;

INITIAL_CAMERA_ALTITUDE = 50; // Roughly 6 feet tall
cameraAltitude = INITIAL_CAMERA_ALTITUDE;
//----------------------------------------------------------------------------
// Utility Functions
//----------------------------------------------------------------------------

// Keep an angle in [-180,180]
function fixAngle(a) {
  while (a < -180) {
    a += 360;
  }
  while (a > 180) {
    a -= 360;
  }
  return a;
}

//----------------------------------------------------------------------------
// Input Handlers
//----------------------------------------------------------------------------

function keyDown(event) {
  if (!event) {
    event = window.event;
  }
  if (event.keyCode == 32) {  //close down
  window.location.replace("index.html");
  }
  if (event.keyCode == 38) {  // Altitude Up
    altitudeUp = true;
    event.returnValue = false;
  } else if (event.keyCode == 40) {  // Altitude Down
    altitudeDown = true;
    event.returnValue = false;
  }
  return false;
}


function keyUp(event) {
  if (!event) {
    event = window.event;
  } 
  if (event.keyCode == 38) {  // Altitude Up
    altitudeUp = false;
    event.returnValue = false;
  } else if (event.keyCode == 40) {  // Altitude Down
    altitudeDown = false;
    event.returnValue = false;
  } else if (event.keyCode == 37) {  // Left.
    turnLeft = false;
    event.returnValue = false;
  } else if (event.keyCode == 39) {  // Right.
    turnRight = false;
    event.returnValue = false;  
  } else if (event.keyCode == 65 || 
             event.keyCode == 97) {  // Strafe Left.
    strafeLeft = false;
    event.returnValue = false;
  } else if (event.keyCode == 68 || 
             event.keyCode == 100) {  // Strafe Right.
    strafeRight = false;
    event.returnValue = false;
  } else if (event.keyCode == 87 || 
             event.keyCode == 119) {  // Move Forward.
    moveForward = false;    
    event.returnValue = false;    
  } else if (event.keyCode == 83 || 
             event.keyCode == 115) {  // Move Forward.
    moveBackward = false;       
  }
  return false;
}



//----------------------------------------------------------------------------
// JSObject - FirstPersonCamera
//----------------------------------------------------------------------------

function FirstPersonCam() {
  var me = this;
 
  // The anchor point is where the camera is situated at. We store
  // the current position in lat, lon, altitude and in cartesian 
  // coordinates.
  x=document.getElementById("hints");
 
  me.localAnchorLla=[-37.7988038, 144.9614694, 0];
  if (navigator.geolocation) {
	   
        navigator.geolocation.getCurrentPosition(showPosition);console.log("dd");
    } else {

        x.innerHTML = "Geolocation is not supported, we will start from The University of Melbourne.";
    }
	function showPosition(position) {
	x.innerHTML="ddc";
	me.localAnchorLla=[position.coords.latitude, position.coords.longitude, 0];
	console.log(me.localAnchorLla);
    x.innerHTML = "Latitude: " + position.coords.latitude + 
    "<br>Longitude: " + position.coords.longitude; 
}

  
   // San Francisco
  me.localAnchorCartesian = V3.latLonAltToCartesian(me.localAnchorLla);

  // Heading, tilt angle is relative to local frame
  me.headingAngle = 0;
  me.tiltAngle = 0;

  // Initialize the time
  me.lastMillis = (new Date()).getTime();  
  
  // Used for bounce.
  me.distanceTraveled = 0;              

  // prevent mouse navigation in the plugin
  ge.getOptions().setMouseNavigationEnabled(false);

  // Updates should be called on frameend to help keep objects in sync.
  // GE does not propogate changes caused by KML objects until an
  // end of frame.
  google.earth.addEventListener(ge, "frameend",
                                function() { me.update(); });
}

FirstPersonCam.prototype.updateOrientation = function(dt) {
  var me = this;

  // Based on dt and input press, update turn angle.
  if (turnLeft || turnRight) {  
    var turnSpeed = 10.0; // radians/sec
    if (turnLeft)
      turnSpeed *= -1;
    me.headingAngle += turnSpeed * dt * Math.PI / 180.0;
  }
  if (tiltUp || tiltDown) {
    var tiltSpeed = 5.0; // radians/sec
    if (tiltDown)
      tiltSpeed *= -1;
    me.tiltAngle = me.tiltAngle + tiltSpeed * dt * Math.PI / 180.0;
    // Clamp
    var tiltMax = 50.0 * Math.PI / 180.0;
    var tiltMin = -90.0 * Math.PI / 180.0;
    if (me.tiltAngle > tiltMax)
      me.tiltAngle = tiltMax;
    if (me.tiltAngle < tiltMin)
      me.tiltAngle = tiltMin;
  } 
}

FirstPersonCam.prototype.updatePosition = function(dt) {
  var me = this;
  
  // Convert local lat/lon to a global matrix. The up vector is 
  // vector = position - center of earth. And the right vector is a vector
  // pointing eastwards and the facing vector is pointing towards north.
  var localToGlobalFrame = M33.makeLocalToGlobalFrame(me.localAnchorLla); 
  
  // Move in heading direction by rotating the facing vector around
  // the up vector, in the angle specified by the heading angle.
  // Strafing is similar, except it's aligned towards the right vec.
  var headingVec = V3.rotate(localToGlobalFrame[1], localToGlobalFrame[2],
                             -me.headingAngle);                             
  var rightVec = V3.rotate(localToGlobalFrame[0], localToGlobalFrame[2],
                             -me.headingAngle);
  // Calculate strafe/forwards                              
  var strafe = 0;                             
  if (strafeLeft || strafeRight) {
    var strafeVelocity = 30;
    if (strafeLeft)
      strafeVelocity *= -1;      
    strafe = strafeVelocity * dt;
  }  
  var forward = 0;                             
  if (moveForward>0) {
    var forwardVelocity = 80*moveForward;
    if (moveBackward>0)
      forwardVelocity *= -1;      
    forward = forwardVelocity * dt;
  }  
  if (altitudeUp) {
    cameraAltitude += 0.1;
  } else if (altitudeDown) {
    cameraAltitude -= 0.1;
  }
  cameraAltitude = Math.max(0, cameraAltitude);
  
  me.distanceTraveled += forward;

  // Add the change in position due to forward velocity and strafe velocity 
  me.localAnchorCartesian = V3.add(me.localAnchorCartesian, 
                                   V3.scale(rightVec, strafe));
  me.localAnchorCartesian = V3.add(me.localAnchorCartesian, 
                                   V3.scale(headingVec, forward));
                                                                        
  // Convert cartesian to Lat Lon Altitude for camera setup later on.
  me.localAnchorLla = V3.cartesianToLatLonAlt(me.localAnchorCartesian);
}

FirstPersonCam.prototype.updateCamera = function() {
  var me = this;
           
  var lla = me.localAnchorLla;
  lla[2] = ge.getGlobe().getGroundAltitude(lla[0], lla[1]); 
  
  // Will put in a bit of a stride if the camera is at or below 1.7 meters
  var bounce = 0;  
  if (cameraAltitude <= INITIAL_CAMERA_ALTITUDE /* 1.7 */) {
    bounce = 1 * Math.abs(Math.sin(4 * me.distanceTraveled *
                                     Math.PI / 180)); 
  }
    
  // Update camera position. Note that tilt at 0 is facing directly downwards.
  //  We add 90 such that 90 degrees is facing forwards.
  var la = ge.createLookAt('');
  la.set(me.localAnchorLla[0], me.localAnchorLla[1],
         cameraAltitude + bounce,
         ge.ALTITUDE_RELATIVE_TO_SEA_FLOOR,
         fixAngle(me.headingAngle * 180 / Math.PI), /* heading */         
         me.tiltAngle * 180 / Math.PI + 90, /* tilt */         
         0 /* altitude is constant */         
         );  
  ge.getView().setAbstractView(la);         
};

FirstPersonCam.prototype.update = function() {
  var me = this;
  
  ge.getWindow().blur();
  
  // Update delta time (dt in seconds)
  var now = (new Date()).getTime();  
  var dt = (now - me.lastMillis) / 1000.0;
  if (dt > 0.25) {
    dt = 0.25;
  }  
  me.lastMillis = now;    
    
  // Update orientation and then position  of camera based
  // on user input   
  me.updateOrientation(dt);
  me.updatePosition(dt);
           
  // Update camera
  me.updateCamera();
};


//xlabs' control
var sdkDemo = {
	prev_roll:0,
	prev_pitch:0,
	prev_z:0,
	sx:0,
	sy:0,
	p_y:0,
   smoothed_face:0,

    setup : function() {
		
    },

    onApiState : function( state ) {
		
    var current_roll = state.kvHeadRoll;
	var current_pitch = state.kvHeadPitch;
	var position_y=state.kvHeadY;
	var z = state.kvHeadZ;
	
	
	var x=current_roll;
	var y=current_pitch;	
		var alpha = 0.8;
			this.sx = x;
			this.sy = y;
		this.sz = z;
		this.p_y=position_y;
	
		this.sx = alpha * this.sx + (1-alpha) * x;
		this.sy = alpha * this.sy + (1-alpha) * y;
		this.sz = alpha * this.sz + (1-alpha) * z;
		this.p_y = alpha * this.p_y + (1-alpha) * position_y;

		//drawGun(this.gun, this.sx, this.sy, this.gun.z, this.gun.length, Math.round(z*100));
	current_roll=this.sx*10;
	current_pitch=this.sy*10;
	z=this.sz;
	position_y=this.p_y;
	
	//do we have face?
	var face=state.kvValidationErrors;
	var face_val=0;
	
	
	if(face=="F")face_val=0;
	else face_val=1;
	var a=0.98;
	var b=1-a;
	this.smoothed_face=this.smoothed_face*a+face_val*b;
	console.log(this.smoothed_face);
	if(this.smoothed_face<0.28)//if no face, no movement
	{
	current_roll=0;
	current_pitch=7;
	z=3;
	document.getElementById("noface").style.visibility="visible";
	}
	else{document.getElementById("noface").style.visibility="hidden";}
	
	//console.log(current_pitch);
	if(current_roll<-2.2)
	{//turn left
		turnLeft=false;
		turnRight=true;
	}
	else turnRight=false;
	if(current_roll>2.2)
	{
		turnLeft=true;
		turnRight=false;
	}
	else turnLeft=false;
	if(current_pitch>8.1)
	{
		altitudeDown=true;
		tiltDown = true;
	}
	else {tiltDown=false;altitudeDown=false;}
	if(current_pitch<6.7)
	{
		tiltUp = true;
		altitudeUp=true;
	}
	else {tiltUp=false;altitudeUp=false;}
	if(z<2)
	{
		moveForward =1.8-z;
	}
	else moveForward=-1;



    },
	


    onApiReady : function() {
     window.postMessage( {target:"xLabs", payload:{overlayEnabled:0}}, "*" );
    window.postMessage( {target:"xLabs", payload:{overlayMode:0}}, "*" );
    window.postMessage( {target:"xLabs", payload:{clicksEnabled:0}}, "*" );
    window.postMessage( {target:"xLabs", payload:{trackingEnabled:1}}, "*" );
    window.postMessage( {target:"xLabs", payload:{trackMouse:0}}, "*" );
    window.postMessage( {target:"xLabs", payload:{pinpointEnabled:0}}, "*" );
    window.postMessage( {target:"xLabs", payload:{realtimeEnabled:1}}, "*" );
    }
  };

  document.addEventListener( "xLabsApiReady", function() {
    sdkDemo.onApiReady();
  } );

  document.addEventListener( "xLabsApiState", function( event ) {
    sdkDemo.onApiState( event.detail );
  } );
  sdkDemo.setup();