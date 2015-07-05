var Ipc = require('ipc');
var Async = require('async');

Ipc.on('scene:play', function () {
    window.sceneView.play();
});

Ipc.on('scene:drop', function ( uuids, type, x, y ) {
    Async.each( uuids, function ( uuid, done ) {
        Async.waterfall([
            function ( next ) {
                Fire.AssetLibrary.loadAsset(uuid, next);
            },

            function ( asset, next ) {
                if ( asset && asset.createNode ) {
                    asset.createNode( next );
                    return;
                }

                next ( null, null );
            },

            function ( node, next ) {
                if ( node ) {
                    // var mousePos = new Fire.Vec2(x, y);
                    // // var worldMousePos = this.renderContext.camera.screenToWorld(mousePos);
                    // var worldMousePos = mousePos;
                    // node.worldPosition = worldMousePos;

                    var fireNode = Fire.node(node);
                    fireNode.position = Fire.v2( x, Fire.engine.canvasSize.y-y );
                    fireNode.parent = Fire.engine.getCurrentScene();

                    // TODO: Editor.Selection.select( 'node', ent.id, true, true );
                }

                next ();
            },

        ], function ( err ) {
            if ( err ) {
                Editor.failed( 'Failed to drop asset %s, message: %s', uuid, err.stack );
                return;
            }
        });
    });
});

Ipc.on('scene:create-assets', function ( uuids, nodeID ) {
    var parentNode;
    if ( nodeID ) {
        parentNode = Fire.node(Fire.engine.getInstanceById(nodeID));
    }
    if ( !parentNode ) {
        parentNode = Fire.engine.getCurrentScene();
    }

    //
    Async.each( uuids, function ( uuid, done ) {
        Async.waterfall([
            function ( next ) {
                Fire.AssetLibrary.loadAsset(uuid, next);
            },

            function ( asset, next ) {
                if ( asset && asset.createNode ) {
                    asset.createNode( next );
                    return;
                }

                next ( null, null );
            },

            function ( node, next ) {
                if ( node ) {
                    var fireNode = Fire.node(node);
                    if ( parentNode ) {
                        fireNode.parent = parentNode;
                    }
                }

                next ();
            },

        ], function ( err ) {
            if ( err ) {
                Editor.failed( 'Failed to drop asset %s, message: %s', uuid, err.stack );
                return;
            }
        });
    });
});

Ipc.on('scene:query-hierarchy', function () {
    var nodes = Fire.takeHierarchySnapshot();
    Editor.sendToWindows( 'scene:reply-query-hierarchy', nodes );
});


Ipc.on('scene:query-node', function ( id ) {
    var node = Fire.engine.getInstanceById(id);
    var dump = Editor.getNodeDump(node);
    Editor.sendToWindows( 'scene:reply-query-node', dump );
});

Ipc.on('scene:node-set-property', function ( id, path, value ) {
    var node = Fire.engine.getInstanceById(id);
    // TODO:
    Editor.info( 'TODO: @jare please implement node.setPath(\'%s\',%s)', path, value );
});

Ipc.on('scene:move-nodes', function ( ids, parentID, nextSiblingId ) {
    var parent = parentID && Fire.node(Fire.engine.getInstanceById(parentID));
    var next = nextSiblingId ? Fire.node(Fire.engine.getInstanceById(nextSiblingId)) : null;
    var nextIndex = next ? next.getSiblingIndex() : -1;

    for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var node = Fire.node(Fire.engine.getInstanceById(id));
        if (node && (!parent || !parent.isChildOf(node))) {
            if (node.parent !== parent) {
                // TODO: ask @jare
                // // keep world transform not changed
                // var worldPos = node.transform.worldPosition;
                // var worldRotation = node.transform.worldRotation;
                // var lossyScale = node.transform.worldScale;

                node.parent = parent;

                // TODO: ask @jare
                // // restore world transform
                // node.transform.worldPosition = worldPos;
                // node.transform.worldRotation = worldRotation;
                // if (parent) {
                //     node.transform.scale = lossyScale.divSelf(parent.transform.worldScale);
                // }
                // else {
                //     node.transform.scale = lossyScale;
                // }

                if (next) {
                    node.setSiblingIndex(nextIndex);
                    ++nextIndex;
                }
            }
            else if (next) {
                var lastIndex = node.getSiblingIndex();
                var newIndex = nextIndex;
                if (newIndex > lastIndex) {
                    --newIndex;
                }
                if (newIndex !== lastIndex) {
                    node.setSiblingIndex(newIndex);
                    if (lastIndex > newIndex) {
                        ++nextIndex;
                    }
                    else {
                        --nextIndex;
                    }
                }
            }
            else {
                node.setAsLastSibling();
            }
        }
    }
});
