// @flow

import 'babel-polyfill';
import path from 'path';
import Koa from 'koa';
import Pug from 'koa-pug';
import Router from 'koa-router';
import koaLogger from 'koa-logger';
import serve from 'koa-static';
import middleware from 'koa-webpack';
import bodyParser from 'koa-bodyparser';
import session from 'koa-generic-session';
import flash from 'koa-flash-simple';
import _ from 'lodash';
import methodOverride from 'koa-methodoverride';
import rollbar from 'rollbar';

import getWebpackConfig from '../webpack.config.babel';
import addRoutes from './controllers';
import container from './container';

export default () => {
  rollbar.init('b2e6698132974eb094b43e6dc34ef8de');

  const app = new Koa();

  app.keys = ['some secret hurr'];
  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      rollbar.handleError(err);
    }
  });
  app.use(session(app));
  app.use(flash());
  app.use(async (ctx, next) => {
    /*eslint-disable */
    ctx.state = {
      /*eslint-enable */
      flash: ctx.flash,
      isSignedIn: () => ctx.session.userId !== undefined,
    };
    await next();
  });
  app.use(bodyParser());
  app.use(methodOverride((req) => {
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
      /*eslint-disable */
      return req.body._method;
      /*eslint-enable */
    }
    return true;
  }));
  app.use(serve(path.join(__dirname, '..', 'public')));

  if (process.env.NODE_ENV !== 'test') {
    app.use(middleware({
      config: getWebpackConfig(),
    }));
  }

  app.use(koaLogger());
  const router = new Router();
  addRoutes(router, container);
  app.use(router.allowedMethods());
  app.use(router.routes());

  const pug = new Pug({
    viewPath: path.join(__dirname, 'views'),
    debug: true,
    pretty: true,
    compileDebug: true,
    locals: [],
    basedir: path.join(__dirname, 'views'),
    helperPath: [
      { _ },
      { urlFor: (...args) => router.url(...args) },
    ],
  });
  pug.use(app);
  return app;
};
