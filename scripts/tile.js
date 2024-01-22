

function Tile(obj, gridInstance){
	
	//private properties
	var pTile = obj;
	var pAsin = findasin();
	var pGrid = gridInstance;
	pGrid.addTile(this);
	var pToolbar = null;
	
	var pVoteFees = 0;
	var pVoteNoFees = 0;
	var pVoteOwn = null;
	
	var pOrderSuccess = 0;
	var pOrderFailed = 0;
	
	//#################
	//## Private method
	function findasin(){
		return getAsinFromDom(pTile);
	}
	
	function getFees(){
		if(pVoteFees - pVoteNoFees >= appSettings.unavailableTab.consensusThreshold)
			return CONSENSUS_FEES;
		else if(pVoteNoFees - pVoteFees >= appSettings.unavailableTab.consensusThreshold)
			return CONSENSUS_NO_FEES;
		else
			return NO_CONSENSUS;
	}
	
	async function animateVanish(tile){
		let defaultOpacity = $(tile).css("opacity");
		tile.animate({
			height: ["20%", "swing"],
		},
		{
			duration: 300,
			queue: false
		});
		
		await tile.delay(150).animate({
			opacity: "hide"
		},
		{
			duration: 150,
			complete: function() {
				$(tile).css({
					'opacity': defaultOpacity,
					'height': '100%'
				});
			}
		}).promise(); //Converting the animation to a promise allow for the await clause to work.
		
	}

	//#################
	//## Public methods
	this.setToolbar = function(toolbarInstance){
		pToolbar = toolbarInstance;
	}
	this.getToolbar = function(){
		return pToolbar;
	}
	
	this.setVotes = function(no, yes, own){
		pVoteFees = yes;
		pVoteNoFees = no;
		pVoteOwn = own;
	};
	
	this.setOrders = function(success, failed){
		pOrderSuccess = success;
		pOrderFailed = failed;
	}
	
	this.getVoteFees = function(){
		return pVoteFees;
	};
	this.getVoteNoFees = function(){
		return pVoteNoFees;
	};
	this.getVoteOwn = function(){
		return pVoteOwn;
	};
	this.getOrderSuccess = function(){
		return pOrderSuccess;
	};
	this.getOrderFailed = function(){
		return pOrderFailed;
	};
	
	this.getFees = function(){
		return getFees();
	};
	
	this.wasOrdered = function(){
		return pOrderSuccess>0 || pOrderFailed>0;
	};
	
	this.getStatus = function(){
		if(pOrderSuccess > 0  &&  pOrderSuccess > pOrderFailed)
			return NOT_DISCARDED_ORDER_SUCCESS;
		
		if(pOrderFailed > 0 && pOrderFailed > pOrderSuccess)
			return DISCARDED_ORDER_FAILED;
		
		if(pVoteOwn == 1 && appSettings.unavailableTab.selfDiscard)
			return DISCARDED_OWN_VOTE;
		
		if(getFees() == CONSENSUS_FEES)
			return DISCARDED_WITH_FEES;
		
		if(pVoteOwn == 0)
			return NOT_DISCARDED_OWN_VOTE;
		
		if(getFees() == CONSENSUS_NO_FEES)
			return NOT_DISCARDED_NO_FEES;
		
		return NOT_DISCARDED_NO_STATUS;
	};
	
	this.getAsin = function(){
		return pAsin;
	};
	
	this.getDOM = function(){
		return pTile;
	};
	
	this.getGrid = function(){
		return pGrid;
	};
	
	this.getGridId = function(){
		return pGrid.getId();
	};
	
	this.setDateAdded = function(mysqlDate){
		if(mysqlDate == undefined)
			return false;
		
		if(!appSettings.general.displayFirstSeen)
			return false;
		
		let t = mysqlDate.split(/[- :]/);
		let jsDate = new Date(Date.UTC(t[0], t[1]-1, t[2], parseInt(t[3])+5, t[4], t[5]));//+5hrs for the server time
		
		$("<div>")
			.addClass("ext-helper-date-added")
			.text("First seen: " + timeSince(jsDate) + " ago")
			.appendTo($(pTile).find(".ext-helper-img-container"));
		
	}
	
	this.moveToGrid = async function(g, animate = false){
		//If we are asking to move the tile to the same grid, don't do anything
		if(g.getId() == pGrid.getId())
			return false; 
		
		if(pGrid != null){
			pGrid.removeTile(this);
		}
		pGrid = g;
		pGrid.addTile(this);
		
		if(animate)
			await animateVanish($(pTile)); //Will hide the tile
		
		$(pTile).detach().appendTo("#" + $(pGrid.getDOM()).attr("id"));
		$(pTile).show();
		
		return true;
	};
	
	this.isHidden = function(){
		if(!appSettings.hiddenTab.active)
			return false;
		
		var found = false;
		$.each(appSettings.hiddenTab.arrItems, function(key, value){
			if(value.asin == pAsin){
				found = true;
				return;
			}
		});
		return found;
	};
	
	this.hideTile = async function(animate=true){
		//Add the item to the list of hidden items
		appSettings.hiddenTab.arrItems.push({"asin" : pAsin, "date": new Date});
		saveSettings(); //from preboot.js: Save the new array
		
		//Move the tile
		await this.moveToGrid(gridHidden, animate);
		
		pToolbar.updateVisibilityIcon();
		
		//Refresh grid counts
		updateTileCounts();
	}
	
	this.showTile = async function(animate=true){
		
		//Remove the item from the array of hidden items
		$.each(appSettings.hiddenTab.arrItems, function(key, value){
			if(value != undefined && value.asin == pAsin){
				appSettings.hiddenTab.arrItems.splice(key, 1);
			}
		});
		saveSettings(); //from preboot.js: Save the new array
		
		//Move the tile
		if(appSettings.unavailableTab.consensusDiscard && tile.getStatus() >= NOT_DISCARDED){
			await tile.moveToGrid(gridUnavailable, animate);
		} else if(appSettings.unavailableTab.selfDiscard && tile.getStatus() == DISCARDED_OWN_VOTE){
			await tile.moveToGrid(gridUnavailable, animate);
		} else {
			await this.moveToGrid(gridRegular, animate);
		}
		
		pToolbar.updateVisibilityIcon();
		
		//Refresh grid counts
		updateTileCounts();
	}
	
	

}



function timeSince(date) {

	var seconds = Math.floor((new Date() - date) / 1000);
	var interval = seconds / 31536000;

	if (interval > 1) 
	return Math.floor(interval) + " years";

	interval = seconds / 2592000;
	if (interval > 1) 
		return Math.floor(interval) + " months";

	interval = seconds / 86400;
	if (interval > 1)
		return Math.floor(interval) + " days";

	interval = seconds / 3600;
	if (interval > 1)
		return Math.floor(interval) + " hrs";

	interval = seconds / 60;
	if (interval > 1)
		return Math.floor(interval) + " mins";

	return Math.floor(seconds) + " secs";
}
