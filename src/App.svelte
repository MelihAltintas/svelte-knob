<script>
    import Knob from "./Knob.svelte"

    var message = "idle"
    const eventHandler = (event) => {
        const d = event.detail
        message = `${d.name} @ ${d.value} -- ${event.type}: ${d.delta}`
    }

</script>
    
    <main>
        <Knob 
            name="default" 
            value={50} 
            on:changeStart={eventHandler}
            on:changing={eventHandler}
            on:changeEnd={eventHandler}
            />
        <Knob 
            name="stepped" 
            value={30} 
            step={10} 
            strokeWidth={8} 
            primaryColor="#E844C3" 
            secondaryColor="#E7B6DC" 
            textColor="#E844C3"
            on:changeStart={eventHandler}
            />
        <Knob 
            name="negative" 
            value={45} 
            min={-10} 
            max={100} 
            on:changeEnd={eventHandler}
            />
        <h3>{message}</h3>
    </main>
    
    <style>
    
    </style>
    