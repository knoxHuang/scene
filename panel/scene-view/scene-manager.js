var Async = require('async');
var sandbox = require('./sandbox');

var _sceneView;

function enterEditMode ( stashedScene, next ) {
    if ( stashedScene ) {
        // restore selection
        Editor.Selection.select('node', stashedScene.sceneSelection, true, true);

        // restore scene view
        _sceneView.initPosition(stashedScene.sceneOffsetX,
                              stashedScene.sceneOffsetY,
                              stashedScene.sceneScale );
    }

    next();
}

function createScene (sceneJson, next) {
    //var MissingBehavior = require('./missing-behavior');

    // reset scene view
    _sceneView.reset();

    cc.AssetLibrary.loadJson(sceneJson, next);
}

Editor.runDefaultScene = function () {
    var scene = new cc.Scene();
    var canvas = new cc.Node('Canvas');
    canvas.parent = scene;
    canvas.addComponent(cc.Canvas);

    cc.director.runScene(scene);
};

Editor.initScene = function (callback) {
    var stashedScene = Editor.remote.stashedScene; // a remote sync method
    var sceneJson = stashedScene ? stashedScene.sceneJson : null;
    if (sceneJson) {
        // load last editing scene
        Async.waterfall(
            [
                sandbox.loadCompiledScript,
                createScene.bind(this, sceneJson),
                function (scene, next) {
                    cc.director.runScene(scene);
                    cc.engine.repaintInEditMode();
                    next( null, stashedScene );
                },
                enterEditMode,
            ],
            callback
        );
    }
    else {
        Async.waterfall([
            sandbox.loadCompiledScript,
            function ( next ) {
                var currentSceneUuid = Editor.remote.currentSceneUuid;
                if ( currentSceneUuid ) {
                    cc.director._loadSceneByUuid(currentSceneUuid, function ( err ) {
                        _sceneView.adjustToCenter(10);
                        cc.engine.repaintInEditMode();
                        next ( err, null );
                    });
                    return;
                }
                else {
                    Editor.runDefaultScene();
                }

                _sceneView.adjustToCenter(10);
                next( null, null );
            },
            enterEditMode,
        ], callback );
    }
};

Editor.stashScene = function (callback) {
    // get scene json
    var scene = cc.director.getScene();
    var jsonText = Editor.serialize(scene, {stringify: true});

    // store the scene, scene-view postion, scene-view scale
    Editor.remote.stashedScene = {
        sceneJson: jsonText,
        sceneScale: _sceneView.scale,
        sceneOffsetX: _sceneView.$.grid.xAxisOffset,
        sceneOffsetY: _sceneView.$.grid.yAxisOffset,
        sceneSelection: Editor.Selection.curSelection('node'),
        designWidth: _sceneView.$.gizmosView.designSize[0],
        designHeight: _sceneView.$.gizmosView.designSize[1],
    };

    if ( callback ) {
        callback(null, jsonText);
    }
};

Editor.reloadScene = function (callback) {
    Async.waterfall([
        Editor.stashScene,
        createScene,
        function (scene, next) {
            cc.director.runScene(scene);
            cc.engine.repaintInEditMode();
            next( null, Editor.remote.stashedScene );
        },
        enterEditMode,
    ], callback );
};

Editor.playScene = function (callback) {
    // store selection
    var selection = Editor.Selection.curSelection('node');

    Async.waterfall([
        Editor.stashScene,
        createScene,    // instantiate a new scene to play
        function (scene, next) {
            // setup scene list
            cc.game._sceneInfos = Editor.remote.sceneList.map(function ( info ) {
                return { url: info.url, uuid: info.uuid };
            });

            // reset scene camera
            scene.position = cc.Vec2.ZERO;
            scene.scale = cc.Vec2.ONE;

            // play new scene
            cc.director.runScene(scene, function () {
                // restore selection
                Editor.Selection.select('node', selection, true, true);

                //
                _sceneView.$.grid.hidden = true;
                _sceneView.$.gizmosView.hidden = true;

                //if (this.$.pause.active) {
                //    cc.engine.step();
                //}
                //else {
                cc.engine.play();
                //}
            });
            next();
        },
    ], callback);
};

Editor.softReload = function (compiled) {
    // hot update new compiled scripts
    sandbox.reload(compiled);
};

module.exports = {
    init: function (sceneView) {
        _sceneView = sceneView;
    }
};
