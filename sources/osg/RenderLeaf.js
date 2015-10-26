define( [
    'osg/Matrix'
], function ( Matrix ) {

    'use strict';


    var CacheUniformApply = function ( state, program ) {
        this.modelWorldUniform = program._uniformsCache[ state.modelWorldMatrix.name ];
        this.viewUniform = program._uniformsCache[ state.viewMatrix.name ];

        this.apply = undefined;
        this.Matrix = Matrix;
        this.generateUniformsApplyMethods();
    };

    CacheUniformApply.prototype = {


        generateUniformsApplyMethods: function () {

            var functionStr = [ '//generated by RenderLeaf\n' ];
            functionStr.push( 'var gl = state.getGraphicContext();' );
            functionStr.push( 'var matrixModelViewChanged = state.applyModelViewMatrix( modelview );' );
            functionStr.push( 'state.applyProjectionMatrix( projection );' );

            if ( this.modelWorldUniform !== undefined ) {
                functionStr.push( 'if ( matrixModelViewChanged ) {' );
                functionStr.push( '    var modelWorldMatrix = state.modelWorldMatrix;' );
                functionStr.push( '    this.Matrix.copy(modelworld, modelWorldMatrix.get() );' );
                functionStr.push( '    modelWorldMatrix.dirty();' );
                functionStr.push( '    modelWorldMatrix.apply( gl, this.modelWorldUniform);' );
                functionStr.push( '};' );
            }

            if ( this.viewUniform !== undefined ) {
                functionStr.push( 'if ( matrixModelViewChanged ) {' );
                functionStr.push( '    var viewMatrix = state.viewMatrix;' );
                functionStr.push( '    this.Matrix.copy(view, viewMatrix.get() );' );
                functionStr.push( '    viewMatrix.dirty();' );
                functionStr.push( '    viewMatrix.apply( gl, this.viewUniform);' );
                functionStr.push( '};' );
            }

            // I am the evil, so please bother someone else
            /*jshint evil: true */
            var func = new Function( 'state', 'modelview', 'modelworld', 'view', 'projection', functionStr.join( '\n' ) );
            /*jshint evil: false */

            this.apply = func;
        }
    };


    var RenderLeaf = function () {

        this._parent = undefined;
        this._geometry = undefined;
        this._depth = 0.0;

        this._projection = undefined;
        this._view = undefined;
        this._modelWorld = undefined;
        this._modelView = undefined;
    };

    RenderLeaf.prototype = {

        reset: function () {
            this._parent = undefined;
            this._geometry = undefined;
            this._depth = 0.0;

            this._projection = undefined;
            this._view = undefined;
            this._modelWorld = undefined;
            this._modelView = undefined;
        },

        init: function ( parent, geom, projection, view, modelView, modelWorld, depth ) {

            this._parent = parent;
            this._geometry = geom;
            this._depth = depth;

            this._projection = projection;
            this._view = view;
            this._modelWorld = modelWorld;
            this._modelView = modelView;

        },

        drawGeometry: ( function () {

            return function ( state ) {


                var program = state.getLastProgramApplied();
                var programInstanceID = program.getInstanceID();
                var cache = state.getCacheUniformsApplyRenderLeaf();
                var obj = cache[ programInstanceID ];

                if ( !obj ) {
                    obj = new CacheUniformApply( state, program );
                    cache[ programInstanceID ] = obj;
                }

                obj.apply( state, this._modelView, this._modelWorld, this._view, this._projection, this._normal );

                this._geometry.drawImplementation( state );

            };
        } )(),

        render: ( function () {
            var previousHash;

            return function ( state, previousLeaf ) {

                var prevRenderGraph;
                var prevRenderGraphParent;
                var rg;

                if ( previousLeaf !== undefined ) {

                    // apply state if required.
                    prevRenderGraph = previousLeaf._parent;
                    prevRenderGraphParent = prevRenderGraph.parent;
                    rg = this._parent;

                    if ( prevRenderGraphParent !== rg.parent ) {

                        rg.moveStateGraph( state, prevRenderGraphParent, rg.parent );

                        // send state changes and matrix changes to OpenGL.

                        state.applyStateSet( rg.stateset );
                        previousHash = state.getStateSetStackHash();

                    } else if ( rg !== prevRenderGraph ) {

                        // send state changes and matrix changes to OpenGL.
                        state.applyStateSet( rg.stateset );
                        previousHash = state.getStateSetStackHash();

                    } else {

                        // in osg we call apply but actually we dont need
                        // except if the stateSetStack changed.
                        // for example if insert/remove StateSet has been used
                        var hash = state.getStateSetStackHash();
                        if ( previousHash !== hash ) {
                            this._parent.moveStateGraph( state, undefined, this._parent.parent );
                            state.applyStateSet( this._parent.stateset );
                            previousHash = hash;
                        }
                    }

                } else {

                    this._parent.moveStateGraph( state, undefined, this._parent.parent );
                    state.applyStateSet( this._parent.stateset );
                    previousHash = state.getStateSetStackHash();

                }

                this.drawGeometry( state );

            };
        } )()

    };

    return RenderLeaf;

} );
