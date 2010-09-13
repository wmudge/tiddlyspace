/***
|''Name''|TiddlySpaceRevisionView|
|''Description''|Show tiddler revisions in a stack of cards view|
|''Author''|BenGillies|
|''Version''|0.1.1|
|''Status''|beta|
|''Source''|http://github.com/TiddlySpace/tiddlyspace|
|''CodeRepository''|http://github.com/TiddlySpace/tiddlyspace|
|''License''|[[BSD|http://www.opensource.org/licenses/bsd-license.php]]|
|''CoreVersion''|2.6.0|
|''Requires''|TiddlyWebAdaptor|
!Usage
The viewRevisions macro can be attached to any element, which should be passed
in as a parameter.

For example:

&lt;&lt;viewRevisions page:10 link:"<<view modified date>>"&gt;&gt;

would show the revisions "stack of cards" view, 10 at a time, when the modified
date is clicked.
!Code
***/
//{{{
(function($) {

var me;
config.macros.viewRevisions = me = {
	revisionTemplate: "RevisionTemplate",
	revSuffix: " [rev. #%0]",
	defaultPageSize: 10,
	defaultLinkText: "View Revisions",
	offsetTop: 30, //in px
	offsetLeft: 10, //in px
	shiftDownDelay: 50, //in ms
	visibleSlideAmount: 20, //amount of revisions to show on left hand edge after sliding
	zIndex: 100, //default z-index
	handler: function(place, macroName, params, wikifier, paramString, tiddler) {
		params = paramString.parseParams(null, null, true)[0];
		var tiddlerElem = story.findContainingTiddler(place);

		//var revButton = $('<span class="button openRevisions" />')
		var revButton;
		var pageSize = parseInt(params.page[0], 10) || me.defaultPageSize;
		var linkObj = params.link ? params.link[0] || me.defaultLinkText : false;
		if(linkObj) {
			 revButton = $('<span class="button openRevisions" />')
				.appendTo(place);
			wikify(linkObj, revButton[0], null, tiddler);
		} else {
			revButton = place;
		}
		//wikify(linkObj, revButton[0], null, tiddler);

		$(revButton).click(function() {
			if (!$(tiddlerElem).hasClass("revisions")) {
				me.showRevisions(tiddlerElem, tiddler, pageSize);
			} else {
				me.closeRevisions(tiddlerElem);
			}
		});
	},
	showRevisions: function(tiddlerElem, tiddler, pageSize) {
		var context = {
			host: tiddler.fields["server.host"],
			workspace: tiddler.fields["server.workspace"]
		};
		$(tiddlerElem).addClass('revisions');
		$(tiddlerElem).attr("revName", tiddler.title);
		$("a", ".toolbar", tiddlerElem).each(function(index, btn) {
			var _onclick = btn.onclick;
			$(btn).click(function() {
				me.closeRevisions(tiddlerElem);
				_onclick.apply(this, arguments);
			});
		});
		var type = tiddler.fields["server.type"];
		var adaptor = new config.adaptors[type]();
		var userParams = {
			tiddlerElem: tiddlerElem,
			pageSize: pageSize,
			title: tiddler.title
		};
		me.createCloak(tiddlerElem);
		adaptor.getTiddlerRevisionList(tiddler.title, null, context, userParams,
				function (context, userParams) {
					//strip the current revision
					context.revisions.shift();
					me.expandStack(context, userParams);
				});
	},
	showRevision: function(place, revision, callback) {
		var context = {
			host: revision.fields["server.host"],
			workspace: revision.fields["server.workspace"]
		};
		var userParams = {
			revElem: place
		};
		var type = revision.fields["server.type"];
		var adaptor = new config.adaptors[type]();
		var revNo = revision.fields["server.page.revision"];
		adaptor.getTiddlerRevision(revision.title, revNo, context, userParams,
			function(context, userParams) {
				var tiddler = context.tiddler;
				tiddler.title += me.revSuffix
					.format([$(place).attr("revision")]);
				tiddler.fields.doNotSave = true;
				if (store.getTiddler(tiddler.title)) {
					store.deleteTiddler(tiddler.title);
				}
				store.addTiddler(tiddler);

				//now, populate the existing div
				var revElem = userParams.revElem;
				$(revElem).attr('id', story.tiddlerId(tiddler.title));
				$(revElem).attr("refresh", "tiddler");
				story.refreshTiddler(tiddler.title, me.revisionTemplate, true);
				callback(tiddler);
			});
	},
	createCloak: function(promoteElem) {
		//store for later
		$(promoteElem).attr("zindex", $(promoteElem).css("z-index"));
		$(promoteElem).attr("top", $(promoteElem).css("top"));
		$(promoteElem).attr("left", $(promoteElem).css("left"));

		$('<div class="revisionCloak" />').css("z-index", me.zIndex)
			.click(function() {
				me.closeRevisions(promoteElem);
			})
			.appendTo(document.body);

		$(promoteElem).css("z-index", me.zIndex + 1);
	},
	closeRevisions: function(promoteElem) {
		//revert the original tiddler back to its previous state
		$(promoteElem)
			.css("z-index", $(promoteElem).attr("zindex"))
			.css("top", $(promoteElem).attr("top"))
			.css("left", $(promoteElem).attr("left"))
			.removeAttr("zindex")
			.removeAttr("top")
			.removeAttr("left")
			.removeAttr("revName")
			.removeClass("revisions");

		//remove any revisions still in the store
		var revisions = $(".revisions");
		$(".revisions").each(function(index, revision) {
			var revName = revision.attributes["revname"].value;
			var revNo = revision.attributes["revision"].value;
			var title = revName + me.revSuffix.format([revNo]);

			if (store.getTiddler(title)) {
				store.deleteTiddler(title);
			}
		});

		//delete the previous revisions
		revisions.remove();

		//remove the cloak
		$(".revisionCloak").remove();
	},
	expandStack: function(context, userParams) {
		var pageSize = userParams.pageSize;

		var from = userParams.from || 0;
		var tiddlerElem = userParams.tiddlerElem;

		userParams.defaultHeight = $(tiddlerElem).height();
		userParams.defaultWidth = $(tiddlerElem).width();
		if (from < context.revisions.length) {
			me.displayNextRevision(tiddlerElem, userParams, context, from,
				from + pageSize - 1);
		}
	},
	displayNextRevision: function(tiddlerElem, userParams, context, from, to) {
		var revision = context.revisions[from];
		function callback() {
			var revText = revBtn.getRevisionText(tiddlerElem, revision);
			tiddlerElem = me.createRevisionObject(tiddlerElem, context,
				userParams, revText);
			$(tiddlerElem)
				.attr("revision", (context.revisions.length - from));
			if ((from < to) && ((from + 1) < context.revisions.length)){
				me.displayNextRevision(tiddlerElem, userParams, context,
					from + 1, to);
			} else if ((context.revisions.length - 1) > to) {
				me.showMoreButton(tiddlerElem, context, userParams, to + 1);
			}
		}
		me.shiftVisibleDown(userParams.title, callback);
	},
	createRevisionObject: function(tiddlerElem, context, userParams, text) {
		var newPosition = me.calculatePosition(tiddlerElem, context);
		return $('<div class="revisions tiddler" />')
			.css({
				position: "absolute",
				top: newPosition.top,
				left: newPosition.left,
				"z-index": me.zIndex + 1,
				height: userParams.defaultHeight,
				width: userParams.defaultWidth
			})
			.attr("revName", userParams.title)
			.append(text)
			.insertBefore(tiddlerElem);
	},
	shiftVisibleDown: function(title, callback) {
		var revisions = $("[revName=%0].revisions".format([title]));
		var revisionCount = revisions.length;
		
		$(revisions).animate({top: "+=" + me.offsetTop},
				me.shiftDownDelay, function() {
					revisionCount -= 1;
					if ((callback) && (!revisionCount)) {
						callback();
					}
				});
	},
	calculatePosition: function(elem, context) {
		var offset = $(elem).offset();
		var currentPosition = $(elem).position();
		var newPosition = {
			top: currentPosition.top - me.offsetTop
		};
		if ((context.restrictLeft) ||
				((offset.left - me.offsetLeft) <
				$("#contentWrapper").offset().left)) {
			newPosition.left = 0;
			context.restrictLeft = true;
		} else {
			newPosition.left = currentPosition.left - me.offsetLeft;
		}
		return newPosition;
	},
	showMoreButton: function(tiddlerElem, context, userParams, moreIndex) {
		userParams.from = moreIndex + 1;
		me.shiftVisibleDown(userParams.title, function() {
			var btn = me.createRevisionObject(tiddlerElem, context, userParams,
				"");

			var more = createTiddlyButton(btn[0], "more...", "show more revisions",
				function() {
					if ($(".viewRevision").length) {
						return;
					}
					userParams.tiddlerElem = btn[0];
					$(btn).text("")
						.append(revBtn
							.getRevisionText(btn[0], context.revisions[moreIndex]))
						.attr("revision", context.revisions.length - moreIndex);
					me.expandStack(context, userParams);
				});
			$(more).css("float", "right");
		});
	},
	stripRevFromTitle: function(revisionTitle) {
		return revisionTitle.split(/ ?\[rev\. #[0-9]+\]$/)[0];
	},
	onClickRevision: function(revElem, revision, callback) {
		// don't do anything if we are still loading
		if ($(".revisions").hasClass("loading")) {
			return null;
		}

		var origTitle = me.stripRevFromTitle(revision.title);
		if ($(revElem).hasClass("viewRevision")) {
			$(".revisions").addClass("loading");
			me.slideIn(revElem, revision, origTitle, function() {
				store.deleteTiddler(revision.title);
				revision.title = origTitle;
				$(revElem).text("").append(revBtn.getRevisionText(revElem,
						revision))
					.removeAttr("tags").removeAttr("tiddler")
					.removeAttr("refresh").removeAttr("template")
					.removeAttr("id");
				$(".revisions").removeClass("loading");
				if (callback) {
					callback();
				}
			});
			$(revElem).removeAttr("prevPos").removeClass("viewRevision");
		} else {
			var viewRevision = function() {
				var prevPos = $(revElem).offset().left;
				$(revElem).addClass("viewRevision").attr("prevPos", prevPos);
				$(".revisions").addClass("loading");
				me.showRevision(revElem, revision, function(rev) {
					me.slideOut(revElem, rev, origTitle, function() {
						$(".revisions").removeClass("loading");
					});
				});
			};
			//make sure another revision isn't already out
			if ($(".viewRevision").length) {
				var newRevElem = $(".viewRevision")[0];
				var newRevision = store.getTiddler($(newRevElem)
					.attr("tiddler"));
				me.onClickRevision(newRevElem, newRevision, viewRevision);
			} else {
				viewRevision();
			}
		}
	},
	slideOut: function(revElem, revision, title, callback) {
		var leftMostPos = $("[revName=%0].revisions".format([title]))
			.offset().left;
		var width = $(revElem).width();
		var originalLeftPos = $(story.getTiddler(title))
			.offset().left;

		var slideAmount = leftMostPos + width - me.visibleSlideAmount;
		$("[revName=%0].revisions:not(.viewRevision)".format([title]))
			.animate({left: "-=" + slideAmount}, 1000);
		$(revElem)
			.attr("baseHeight", $(revElem).css("height"))
			.css("height", "auto")
			.animate({left: originalLeftPos}, 1000, callback);
	},
	slideIn: function(revElem, revision, title, callback) {
		var slideAmount = $(revElem).offset().left -
			$(story.getTiddler(title)).offset().left;
		var origRevPos = $(revElem).attr("prevPos");

		$("[revName=%0].revisions:not(.viewRevision)".format([title]))
			.animate({left: "+=" + slideAmount}, 1000);
		$(revElem).animate({left: origRevPos}, 1000, function() {
			$(revElem)
				.css("height", $(revElem).attr("baseHeight"))
				.removeAttr("baseHeight");
			callback();
		});
	}
};

var revBtn;
config.macros.slideRevision = revBtn = {
	btnText: "created by %0 at %1 on %2",
	handler: function(place, macroName, params, wikifier, paramString, tiddler) {
		var btn = revBtn.getRevisionText(place, tiddler);
		$(place).append(btn);
	},
	getRevisionText: function(place, revision) {
		var text = revBtn.btnText.format([revision.modifier,
			revision.modified.formatString("0hh:0mm"),
			revision.modified.formatString("0DD MMM YYYY")]);
		var btn = $('<a href="javascript:;" class="button revButton" />')
			.text(text)
			.click(function() {
				var revElem = story.findContainingTiddler(this);
				me.onClickRevision(revElem, revision);
			});
		return btn;
	}
};

})(jQuery);
//}}}
