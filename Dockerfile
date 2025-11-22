# VSBTek MediaCast Server
FROM node:18-alpine

WORKDIR /app

# Copy all files
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
