
const utilFormatoFecha = (objetoFecha) => {
    /* const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return objetoFecha.toLocaleDateString('es-ES', options); */
    const meses = ["",
    "enero", "febrero", "marzo",
    "abril", "mayo", "Junio", "julio",
    "agosto", "septiembre", "octubre",
    "noviembre", "diciembre"
    ]
    if (objetoFecha) {
        const sepInformeTecnico = objetoFecha.split('/');
        const diaInformeTecnico = sepInformeTecnico[0];
        const mesInformeTecnico = parseInt(sepInformeTecnico[1]);
        const anioInformeTecnico = sepInformeTecnico[2];
        return `${diaInformeTecnico} de ${meses[mesInformeTecnico]} de ${anioInformeTecnico}`;
    
    } else return '';

/*
    if((new Date('2022-12-08')) instanceof Date){
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return objetoFecha.toLocaleDateString('es-ES', options);
        }
        return null;*/

};

const utilFormatoFecha_v1 = (objetoFecha) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return objetoFecha.toLocaleDateString('es-ES', options);
};


const utilAdicionarDias = (objetoFecha, diasAdicionar) => {
    const objetoFechaClonado = new Date(objetoFecha.getTime());
    objetoFechaClonado.setDate(objetoFechaClonado.getDate() + diasAdicionar);
    return objetoFechaClonado;
};

const utilFormatoFecha_DDMMYYYY = (objetoFecha, stringSeparador) => {
    if(objetoFecha instanceof Date){
        let date, month, year;
        date = objetoFecha.getDate();
        month = objetoFecha.getMonth() + 1;
        year = objetoFecha.getFullYear();
        date = date.toString()
            .padStart(2, '0');
        month = month.toString()
            .padStart(2, '0');
        return `${date}${stringSeparador}${month}${stringSeparador}${year}`;    
    }
    return 'No es un objeto fecha.'
}

module.exports = {
    utilFormatoFecha,
    utilFormatoFecha_v1,
    utilFormatoFecha_DDMMYYYY,
    utilAdicionarDias
};