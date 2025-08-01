// useFetchTime.js
import { useState, useEffect } from "react";

const useFetchTime = () => {
  const [timeData, setTimeData] = useState(null);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchTime = async () => {
      try {
        const response = await fetch(
          "https://timeapi.io/api/Time/current/zone?timeZone=UTC"
        );
        const data = await response.json();
        setTimeData(data);
      } catch (err) {
        console.error("Error fetching time:", err);
        setError(err);
      }
    };
    fetchTime();
  }, []);

  return { timeData, error };
};

export default useFetchTime;
