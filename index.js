import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import { default as expressPlayground } from 'graphql-playground-middleware-express';
import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';

import resolvers from './resolvers';
import { requestGithubToken } from './lib';

require('dotenv').config();

const typeDefs = readFileSync('./typeDefs.graphql', 'UTF-8');

async function start() {
  const app = express();
  const MONGO_DB = process.env.DB_HOST;

  let db;

  try {
    const client = await MongoClient.connect(
      MONGO_DB,
      { useNewUrlParser: true }
    );
    db = client.db();
    console.log('DB connected');
  } catch (error) {
    console.log(`
      Mongo DB Host not found!
      please add DB_HOST environment variable to .env file
      exiting...
    `);
    process.exit(1);
  }

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req }) => {
      const githubToken = req.headers.authorization;
      const currentUser = await db.collection('users').findOne({ githubToken });
      return { db, currentUser };
    }
  });
  server.applyMiddleware({ app });

  app.get('/', (req, res) => {
    res.send('Welcome to PhotoShare API');
  });

  app.get('/playground', expressPlayground({ endpoint: '/graphql' }));

  app.listen({ port: 4000 }, () => {
    console.log(
      `GraphQL server running @ http://localhost:4000${server.graphqlPath}`
    );
  });
}

start();
