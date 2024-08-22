---
title: <% tp.file.title %>
date: <% tp.file.creation_date("YYYY-MM-DD") %>
tags: ['<% tp.system.suggester(item => item, Object.keys(app.metadataCache.getTags()).map(x => x.replace("#", ""))) %>']
toc: "true"
draft: "true"
---


