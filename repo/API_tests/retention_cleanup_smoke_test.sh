#!/bin/sh

MONGO_URI="${TEST_MONGO_URI:-mongodb://mongodb:27017/homecareops_test}" npm --prefix ./backend run retention:cleanup
